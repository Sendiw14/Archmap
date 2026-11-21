import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import {
  AnalysisSummary,
  CreateAnalysisRequest,
  RESULT_STATUSES,
  TERMINAL_STATUSES,
  managementCookieName,
  parseRepositoryInput,
  type CreateAnalysisResponse,
  type ErrorCode,
} from "@archmap/contracts";
import { toMarkdown } from "@archmap/graph-core/report";
import { ArchmapGraph, SCHEMA_VERSION } from "@archmap/graph-schema";
import {
  HostedError,
  cacheKeyFor,
  type AnalysisRecord,
  type AnalysisStore,
  type ArtifactStore,
  type JobQueue,
  type Limits,
  type SourceProvider,
} from "@archmap/hosted";

export interface ApiConfig {
  analyzerVersion: string;
  limits: Limits;
  /** Origins allowed to perform state-changing requests (the web app). */
  allowedOrigins: string[];
  /** Secret for HMAC-ing client addresses (quota keys); never logged. */
  clientKeySecret: string;
  importsEnabled: boolean;
  /** Fastify trustProxy (true / hop count / CIDR list) so request.ip reflects the client. */
  trustProxy: boolean | number | string;
  /** Mark cookies Secure (true in production behind HTTPS). */
  secureCookies: boolean;
  publicBaseUrl?: string;
  logLevel?: string;
}

export interface ApiDeps {
  store: AnalysisStore;
  artifacts: ArtifactStore;
  queue: JobQueue;
  source: SourceProvider;
  now?: () => Date;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const HTTP: Record<ErrorCode, number> = {
  invalid_request: 400,
  invalid_repository: 400,
  unsupported_provider: 400,
  repository_not_found: 404,
  repository_not_public: 403,
  ref_not_found: 404,
  rate_limited: 429,
  github_unavailable: 503,
  imports_disabled: 503,
  queue_full: 503,
  not_found: 404,
  expired: 410,
  not_ready: 409,
  unauthorized: 401,
  conflict: 409,
  limit_exceeded: 413,
  analysis_timeout: 500,
  internal: 500,
};

const fail = (reply: FastifyReply, code: ErrorCode, message: string) =>
  reply.code(HTTP[code]).send({ error: { code, message } });

export function toSummary(r: AnalysisRecord): AnalysisSummary {
  return {
    id: r.id,
    repository: { owner: r.owner, repo: r.repo, url: `https://github.com/${r.owner}/${r.repo}` },
    ref: r.ref,
    commit: r.commit,
    status: r.status,
    error:
      r.status === "failed" && r.errorCode
        ? {
            code: r.errorCode as NonNullable<AnalysisSummary["error"]>["code"],
            message: r.errorMessage ?? "",
          }
        : null,
    analyzerVersion: r.analyzerVersion,
    schemaVersion: r.schemaVersion,
    stats: r.stats,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function buildApp(deps: ApiDeps, cfg: ApiConfig) {
  const now = deps.now ?? (() => new Date());
  const app = Fastify({
    // Fastify accepts a hop count at runtime; its types omit number.
    trustProxy: cfg.trustProxy as boolean | string,
    bodyLimit: 16 * 1024,
    genReqId: () => randomUUID(),
    logger: {
      level: cfg.logLevel ?? "info",
      redact: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
    },
  });

  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: "same-origin" },
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
    if (req.url.startsWith("/v1/")) {
      reply.header("x-robots-tag", "noindex, nofollow");
      if (!reply.hasHeader("cache-control")) reply.header("cache-control", "no-store");
    }
  });

  app.setErrorHandler((err, req, reply) => {
    const e = err as { statusCode?: number; validation?: unknown };
    if (e.statusCode === 429) return fail(reply, "rate_limited", "Too many requests; slow down");
    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500)
      return fail(reply, "invalid_request", "Malformed request");
    req.log.error({ err }, "unhandled error");
    return fail(reply, "internal", "Internal error");
  });
  app.setNotFoundHandler((_req, reply) => fail(reply, "not_found", "Not found"));

  /** CSRF guard for state-changing routes: same-origin browser requests only. */
  const sameOrigin = (req: FastifyRequest) => {
    const origin = req.headers.origin;
    if (origin) return cfg.allowedOrigins.includes(origin);
    const site = req.headers["sec-fetch-site"];
    return site === undefined || site === "same-origin" || site === "none";
  };

  const clientKey = (req: FastifyRequest) =>
    createHmac("sha256", cfg.clientKeySecret).update(req.ip).digest("hex");

  const load = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      fail(reply, "not_found", "Analysis not found");
      return null;
    }
    const rec = await deps.store.get(id);
    if (!rec) {
      fail(reply, "not_found", "Analysis not found");
      return null;
    }
    if (rec.status === "expired" || rec.expiresAt <= now()) {
      fail(reply, "expired", "This analysis has expired and its results were deleted");
      return null;
    }
    return rec;
  };

  const authorized = (req: FastifyRequest, rec: AnalysisRecord) => {
    const token = req.cookies[managementCookieName(rec.id)];
    if (!token || !rec.managementVerifier) return false;
    const a = Buffer.from(sha256(token), "hex");
    const b = Buffer.from(rec.managementVerifier, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  };

  const graphOf = async (rec: AnalysisRecord, reply: FastifyReply): Promise<Buffer | null> => {
    if (!RESULT_STATUSES.includes(rec.status) || !rec.artifactKey) {
      fail(reply, "not_ready", `Analysis is ${rec.status}; no graph is available`);
      return null;
    }
    const body = await deps.artifacts.get(rec.artifactKey);
    if (!body) {
      fail(reply, "expired", "Analysis results are no longer available");
      return null;
    }
    return body;
  };

  // ---------- routes ----------

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_req, reply) => {
    const checks: Record<string, "ok" | "fail"> = {};
    await Promise.all(
      (["store", "queue", "artifacts"] as const).map(async (k) => {
        try {
          await deps[k].ping();
          checks[k] = "ok";
        } catch {
          checks[k] = "fail";
        }
      }),
    );
    const ok = Object.values(checks).every((v) => v === "ok");
    return reply.code(ok ? 200 : 503).send({ status: ok ? "ok" : "unavailable", checks });
  });

  app.post(
    "/v1/analyses",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!cfg.importsEnabled)
        return fail(
          reply,
          "imports_disabled",
          "Public imports are temporarily disabled. Use the local CLI instead.",
        );
      if (!sameOrigin(req)) return fail(reply, "unauthorized", "Cross-origin request rejected");
      if (!String(req.headers["content-type"] ?? "").startsWith("application/json"))
        return fail(reply, "invalid_request", "Content-Type must be application/json");
      const body = CreateAnalysisRequest.safeParse(req.body);
      if (!body.success)
        return fail(reply, "invalid_request", body.error.issues[0]?.message ?? "Invalid request");
      const id = parseRepositoryInput(body.data.repository);
      if (!id) {
        const looksLikeUrl =
          /^[a-z]+:\/\//i.test(body.data.repository.trim()) ||
          /\.[a-z]{2,}\//i.test(body.data.repository);
        return looksLikeUrl
          ? fail(
              reply,
              "unsupported_provider",
              "Only public GitHub repositories (github.com/owner/repo) are supported",
            )
          : fail(
              reply,
              "invalid_repository",
              "Enter a GitHub repository as owner/repo or https://github.com/owner/repo",
            );
      }

      const key = clientKey(req);
      const t = now();
      let resolved;
      try {
        resolved = await deps.source.resolve(id.owner, id.repo, body.data.ref);
      } catch (err) {
        if (err instanceof HostedError) return fail(reply, err.code, err.message);
        throw err;
      }
      const cacheKey = cacheKeyFor(
        resolved.owner,
        resolved.repo,
        resolved.commit,
        cfg.analyzerVersion,
        SCHEMA_VERSION,
        cfg.limits,
      );
      const reusable = await deps.store.findReusable(cacheKey, t);
      if (reusable) {
        const res: CreateAnalysisResponse = {
          analysis: toSummary(reusable),
          reused: true,
          canManage: false,
        };
        return reply.code(200).send(res);
      }

      const recent = await deps.store.countCreatedByClientSince(
        key,
        new Date(t.getTime() - 3_600_000),
      );
      if (recent >= cfg.limits.submissionsPerClientPerHour) {
        reply.header("retry-after", "3600");
        return fail(
          reply,
          "rate_limited",
          `Limit of ${cfg.limits.submissionsPerClientPerHour} new analyses per hour reached`,
        );
      }
      if ((await deps.store.countActive()) >= cfg.limits.maxQueueDepth)
        return fail(reply, "queue_full", "The analysis queue is full; try again in a few minutes");

      const token = randomBytes(32).toString("base64url"); // 256 bits
      const expiresAt = new Date(t.getTime() + cfg.limits.retentionHours * 3_600_000);
      const rec: AnalysisRecord = {
        id: randomUUID(),
        owner: resolved.owner,
        repo: resolved.repo,
        ref: resolved.ref,
        commit: resolved.commit,
        status: "queued",
        errorCode: null,
        errorMessage: null,
        managementVerifier: sha256(token),
        clientKey: key,
        cacheKey,
        analyzerVersion: cfg.analyzerVersion,
        schemaVersion: SCHEMA_VERSION,
        artifactKey: null,
        stats: null,
        attempts: 0,
        createdAt: t,
        updatedAt: t,
        expiresAt,
      };
      await deps.store.create(rec);
      try {
        await deps.queue.enqueue(rec.id);
      } catch (err) {
        await deps.store.transition(rec.id, ["queued"], "failed", {
          errorCode: "internal",
          errorMessage: "Could not queue analysis",
        });
        req.log.error({ err, id: rec.id }, "enqueue failed");
        return fail(reply, "queue_full", "The analysis queue is unavailable; try again later");
      }
      reply.setCookie(managementCookieName(rec.id), token, {
        httpOnly: true,
        secure: cfg.secureCookies,
        sameSite: "strict",
        path: `/v1/analyses/${rec.id}`,
        expires: expiresAt,
      });
      req.log.info(
        { id: rec.id, repo: `${rec.owner}/${rec.repo}`, commit: rec.commit },
        "analysis created",
      );
      const res: CreateAnalysisResponse = {
        analysis: toSummary(rec),
        reused: false,
        canManage: true,
      };
      return reply.code(202).header("location", `/v1/analyses/${rec.id}`).send(res);
    },
  );

  app.get<{ Params: { id: string } }>("/v1/analyses/:id", async (req, reply) => {
    const rec = await load(req, reply);
    if (!rec) return reply;
    return toSummary(rec);
  });

  app.get<{ Params: { id: string } }>("/v1/analyses/:id/graph", async (req, reply) => {
    const rec = await load(req, reply);
    if (!rec) return reply;
    const body = await graphOf(rec, reply);
    if (!body) return reply;
    return reply
      .header("content-type", "application/json; charset=utf-8")
      .header("cache-control", "private, max-age=300")
      .send(body);
  });

  app.get<{ Params: { id: string } }>("/v1/analyses/:id/findings", async (req, reply) => {
    const rec = await load(req, reply);
    if (!rec) return reply;
    const body = await graphOf(rec, reply);
    if (!body) return reply;
    return { findings: (JSON.parse(body.toString()) as ArchmapGraph).findings };
  });

  app.get<{ Params: { id: string }; Querystring: { format?: string } }>(
    "/v1/analyses/:id/report",
    async (req, reply) => {
      const format = req.query.format ?? "markdown";
      if (format !== "markdown" && format !== "json")
        return fail(reply, "invalid_request", "format must be markdown or json");
      const rec = await load(req, reply);
      if (!rec) return reply;
      const body = await graphOf(rec, reply);
      if (!body) return reply;
      const name = `archmap-${rec.owner}-${rec.repo}-${rec.commit.slice(0, 7)}`.replace(
        /[^A-Za-z0-9._-]/g,
        "_",
      );
      if (format === "json")
        return reply
          .header("content-type", "application/json; charset=utf-8")
          .header("content-disposition", `attachment; filename="${name}.json"`)
          .send(body);
      const md = toMarkdown(ArchmapGraph.parse(JSON.parse(body.toString())));
      return reply
        .header("content-type", "text/markdown; charset=utf-8")
        .header("content-disposition", `attachment; filename="${name}.md"`)
        .send(md);
    },
  );

  app.post<{ Params: { id: string } }>("/v1/analyses/:id/cancel", async (req, reply) => {
    if (!sameOrigin(req)) return fail(reply, "unauthorized", "Cross-origin request rejected");
    const rec = await load(req, reply);
    if (!rec) return reply;
    if (!authorized(req, rec))
      return fail(reply, "unauthorized", "Only the creator of this analysis can cancel it");
    if (TERMINAL_STATUSES.includes(rec.status))
      return fail(reply, "conflict", `Analysis is already ${rec.status}`);
    const next = await deps.store.transition(
      rec.id,
      ["queued", "fetching", "analyzing", "persisting"],
      "cancelled",
    );
    if (!next) return fail(reply, "conflict", "Analysis finished before it could be cancelled");
    await deps.queue.remove(rec.id);
    return reply.code(202).send(toSummary(next));
  });

  app.delete<{ Params: { id: string } }>("/v1/analyses/:id", async (req, reply) => {
    if (!sameOrigin(req)) return fail(reply, "unauthorized", "Cross-origin request rejected");
    const rec = await load(req, reply);
    if (!rec) return reply;
    if (!authorized(req, rec))
      return fail(reply, "unauthorized", "Only the creator of this analysis can delete it");
    await deps.store.transition(
      rec.id,
      ["queued", "fetching", "analyzing", "persisting"],
      "cancelled",
    );
    await deps.queue.remove(rec.id);
    if (rec.artifactKey) await deps.artifacts.delete(rec.artifactKey);
    await deps.store.delete(rec.id);
    reply.clearCookie(managementCookieName(rec.id), { path: `/v1/analyses/${rec.id}` });
    req.log.info({ id: rec.id }, "analysis deleted");
    return reply.code(204).send();
  });

  return app;
}
