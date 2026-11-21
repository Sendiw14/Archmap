import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AnalysisSummary,
  CreateAnalysisResponse,
  DEFAULT_LIMITS,
  managementCookieName,
} from "@archmap/contracts";
import { ArchmapGraph } from "@archmap/graph-schema";
import {
  FixtureSource,
  HostedError,
  MemoryArtifacts,
  MemoryQueue,
  MemoryStore,
  processAnalysis,
  type Limits,
  type SourceProvider,
} from "@archmap/hosted";
import { buildApp, type ApiConfig } from "./app.ts";

const FIXTURES = path.resolve(import.meta.dirname, "../../../fixtures");
const ORIGIN = "http://localhost:3000";
const quiet = { info() {}, warn() {}, error() {} };

async function setup(
  opts: {
    cfg?: Partial<ApiConfig>;
    limits?: Partial<Limits>;
    source?: SourceProvider;
    now?: () => Date;
  } = {},
) {
  const store = new MemoryStore();
  const artifacts = new MemoryArtifacts();
  const queue = new MemoryQueue();
  const source = opts.source ?? new FixtureSource(FIXTURES);
  const limits = { ...DEFAULT_LIMITS, ...opts.limits };
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "archmap-api-"));
  queue.handler = (id) =>
    processAnalysis(
      id,
      { store, artifacts, source, limits, workRoot, log: quiet },
      { final: true },
    );
  const app = await buildApp(
    { store, artifacts, queue, source, ...(opts.now ? { now: opts.now } : {}) },
    {
      analyzerVersion: "0.1.0",
      limits,
      allowedOrigins: [ORIGIN],
      clientKeySecret: "x".repeat(32),
      importsEnabled: true,
      trustProxy: false,
      secureCookies: true,
      logLevel: "silent",
      ...opts.cfg,
    },
  );
  const create = (repository: string, headers: Record<string, string> = {}) =>
    app.inject({
      method: "POST",
      url: "/v1/analyses",
      headers: { origin: ORIGIN, ...headers },
      payload: { repository },
    });
  return { app, store, artifacts, queue, create };
}

const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers["set-cookie"];
  return String(Array.isArray(raw) ? raw[0] : raw);
};

describe("POST /v1/analyses -> poll -> results", () => {
  it("runs the full pipeline and serves graph, findings and reports", async () => {
    const { app, queue, create } = await setup();
    const res = await create("archmap-fixtures/circular");
    expect(res.statusCode).toBe(202);
    const body = CreateAnalysisResponse.parse(res.json());
    expect(body).toMatchObject({ reused: false, canManage: true });
    expect(body.analysis.status).toBe("queued");

    const set = cookieOf(res);
    expect(set).toMatch(
      new RegExp(`^${managementCookieName(body.analysis.id)}=[A-Za-z0-9_-]{43};`),
    );
    expect(set).toContain("HttpOnly");
    expect(set).toContain("Secure");
    expect(set).toContain("SameSite=Strict");
    expect(set).toContain(`Path=/v1/analyses/${body.analysis.id}`);

    await queue.idle();
    const status = AnalysisSummary.parse(
      (await app.inject(`/v1/analyses/${body.analysis.id}`)).json(),
    );
    expect(status.status).toBe("completed");
    expect(status.stats).toEqual({ files: 4, edges: 4, findings: 1 });

    const graphRes = await app.inject(`/v1/analyses/${body.analysis.id}/graph`);
    expect(graphRes.headers["x-robots-tag"]).toContain("noindex");
    const graph = ArchmapGraph.parse(graphRes.json());
    expect(graph.metadata.repository.name).toBe("archmap-fixtures/circular");

    const findings = (await app.inject(`/v1/analyses/${body.analysis.id}/findings`)).json();
    expect(findings.findings[0].category).toBe("runtime-cycle");

    const md = await app.inject(`/v1/analyses/${body.analysis.id}/report?format=markdown`);
    expect(md.headers["content-type"]).toContain("text/markdown");
    expect(md.headers["content-disposition"]).toMatch(
      /attachment; filename="archmap-archmap-fixtures-circular-[0-9a-f]{7}\.md"/,
    );
    expect(md.body).toContain("## Cycles");
    expect(
      (await app.inject(`/v1/analyses/${body.analysis.id}/report?format=html`)).statusCode,
    ).toBe(400);
  }, 30_000);

  it("reuses a completed result for the same commit without granting management", async () => {
    const { queue, create } = await setup();
    const first = CreateAnalysisResponse.parse((await create("archmap-fixtures/esm")).json());
    await queue.idle();
    const again = await create("https://github.com/archmap-fixtures/esm");
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({
      reused: true,
      canManage: false,
      analysis: { id: first.analysis.id },
    });
    expect(again.headers["set-cookie"]).toBeUndefined();
  }, 30_000);
});

describe("input validation", () => {
  it("maps bad input to explicit error codes", async () => {
    const { app, create } = await setup();
    expect((await create("not a repo")).json().error.code).toBe("invalid_repository");
    expect((await create("https://gitlab.com/a/b")).json().error.code).toBe("unsupported_provider");
    expect((await create("https://github.com.evil.com/a/b")).json().error.code).toBe(
      "unsupported_provider",
    );
    expect((await create("git@github.com:a/b.git")).json().error.code).toBe("invalid_repository");
    expect((await create("someone/missing")).json().error.code).toBe("repository_not_found");
    const noJson = await app.inject({
      method: "POST",
      url: "/v1/analyses",
      headers: { origin: ORIGIN, "content-type": "text/plain" },
      payload: "x",
    });
    expect(noJson.statusCode).toBe(400);
    const badRef = await app.inject({
      method: "POST",
      url: "/v1/analyses",
      headers: { origin: ORIGIN },
      payload: { repository: "a/b", ref: "../../etc" },
    });
    expect(badRef.json().error.code).toBe("invalid_request");
    expect((await app.inject("/v1/analyses/not-a-uuid")).statusCode).toBe(404);
    expect(
      (await app.inject("/v1/analyses/00000000-0000-4000-8000-000000000000")).json().error.code,
    ).toBe("not_found");
  });

  it("rejects cross-origin creation", async () => {
    const { create } = await setup();
    const res = await create("archmap-fixtures/esm", { origin: "https://evil.example" });
    expect(res.statusCode).toBe(401);
  });

  it("surfaces private repositories and provider outages without leaking details", async () => {
    const fake = (err: HostedError): SourceProvider => ({
      resolve: async () => {
        throw err;
      },
      download: async () => Buffer.alloc(0),
    });
    let r = await (
      await setup({
        source: fake(
          new HostedError("repository_not_public", "Only public repositories can be analyzed"),
        ),
      })
    ).create("a/b");
    expect(r.statusCode).toBe(403);
    r = await (
      await setup({
        source: fake(
          new HostedError("github_unavailable", "GitHub rate limit reached; try again later", true),
        ),
      })
    ).create("a/b");
    expect(r.statusCode).toBe(503);
    const boom: SourceProvider = {
      resolve: async () => {
        throw new Error("db password=hunter2");
      },
      download: async () => Buffer.alloc(0),
    };
    r = await (await setup({ source: boom })).create("a/b");
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain("hunter2");
    expect(r.json()).toEqual({ error: { code: "internal", message: "Internal error" } });
  });
});

describe("dependency outages", () => {
  it("returns 503 service_unavailable with Retry-After when the store is down", async () => {
    const { create, store } = await setup();
    store.findReusable = async () => {
      throw Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:5432"), {
        code: "ECONNREFUSED",
      });
    };
    const r = await create("archmap-fixtures/esm");
    expect(r.statusCode).toBe(503);
    expect(r.headers["retry-after"]).toBe("30");
    expect(r.json().error.code).toBe("service_unavailable");
    expect(r.body).not.toContain("10.0.0.5");
  });

  it("recognises driver errors wrapped by the ORM (cause chain)", async () => {
    const { create, store } = await setup();
    store.findReusable = async () => {
      const driver = Object.assign(new Error("getaddrinfo ENOTFOUND postgres"), {
        code: "ENOTFOUND",
      });
      throw Object.assign(new Error("Failed query: select ..."), {
        name: "DrizzleQueryError",
        cause: driver,
      });
    };
    expect((await create("archmap-fixtures/esm")).json().error.code).toBe("service_unavailable");
  });

  it("still reports genuine bugs as internal", async () => {
    const { create, store } = await setup();
    store.findReusable = async () => {
      throw new TypeError("cannot read properties of undefined");
    };
    expect((await create("archmap-fixtures/esm")).statusCode).toBe(500);
  });
});

describe("quotas and safe-disable", () => {
  it("limits new analyses per client per hour", async () => {
    const { create, store } = await setup({ limits: { submissionsPerClientPerHour: 2 } });
    expect((await create("archmap-fixtures/esm")).statusCode).toBe(202);
    expect((await create("archmap-fixtures/barrel")).statusCode).toBe(202);
    const third = await create("archmap-fixtures/commonjs");
    expect(third.statusCode).toBe(429);
    expect(third.headers["retry-after"]).toBe("3600");
    expect(await store.countActive()).toBeLessThanOrEqual(2);
  }, 30_000);

  it("refuses work when the queue is full", async () => {
    const { create } = await setup({ limits: { maxQueueDepth: 0 } });
    expect((await create("archmap-fixtures/esm")).json().error.code).toBe("queue_full");
  });

  it("can disable public imports", async () => {
    const { create } = await setup({ cfg: { importsEnabled: false } });
    const r = await create("archmap-fixtures/esm");
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("imports_disabled");
  });
});

describe("management capability", () => {
  it("requires the creator's cookie for cancel and delete", async () => {
    const { app, create, artifacts, queue } = await setup();
    const res = await create("archmap-fixtures/circular");
    const { analysis } = CreateAnalysisResponse.parse(res.json());
    const cookie = cookieOf(res).split(";")[0]!;
    await queue.idle();
    const url = `/v1/analyses/${analysis.id}`;

    expect(
      (await app.inject({ method: "DELETE", url, headers: { origin: ORIGIN } })).statusCode,
    ).toBe(401);
    const forged = `${managementCookieName(analysis.id)}=${"A".repeat(43)}`;
    expect(
      (await app.inject({ method: "DELETE", url, headers: { origin: ORIGIN, cookie: forged } }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url,
          headers: { origin: "https://evil.example", cookie },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${url}/cancel`,
          headers: { origin: ORIGIN, cookie },
        })
      ).json().error.code,
    ).toBe("conflict");

    const del = await app.inject({ method: "DELETE", url, headers: { origin: ORIGIN, cookie } });
    expect(del.statusCode).toBe(204);
    expect(artifacts.objects.size).toBe(0);
    expect((await app.inject(url)).statusCode).toBe(404);
  }, 30_000);

  it("cancels a queued analysis", async () => {
    const { app, create, store, queue } = await setup();
    queue.handler = async () => {}; // keep the job from running
    const res = await create("archmap-fixtures/esm");
    const { analysis } = CreateAnalysisResponse.parse(res.json());
    const cookie = cookieOf(res).split(";")[0]!;
    const c = await app.inject({
      method: "POST",
      url: `/v1/analyses/${analysis.id}/cancel`,
      headers: { origin: ORIGIN, cookie },
    });
    expect(c.statusCode).toBe(202);
    expect((await store.get(analysis.id))!.status).toBe("cancelled");
    expect((await app.inject(`/v1/analyses/${analysis.id}/graph`)).json().error.code).toBe(
      "not_ready",
    );
  });
});

describe("expiry and health", () => {
  it("returns 410 after retention", async () => {
    let t = new Date("2026-11-21T00:00:00Z");
    const { app, create, queue } = await setup({ now: () => t });
    const { analysis } = CreateAnalysisResponse.parse(
      (await create("archmap-fixtures/esm")).json(),
    );
    await queue.idle();
    t = new Date("2026-11-22T00:00:01Z");
    const r = await app.inject(`/v1/analyses/${analysis.id}`);
    expect(r.statusCode).toBe(410);
    expect(r.json().error.code).toBe("expired");
  }, 30_000);

  it("reports liveness, readiness and security headers", async () => {
    const { app, store } = await setup();
    const live = await app.inject("/health/live");
    expect(live.json()).toEqual({ status: "ok" });
    expect(live.headers["x-content-type-options"]).toBe("nosniff");
    expect(live.headers["content-security-policy"]).toContain("default-src 'none'");
    expect((await app.inject("/health/ready")).statusCode).toBe(200);
    store.ping = async () => {
      throw new Error("down");
    };
    const ready = await app.inject("/health/ready");
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toEqual({
      status: "unavailable",
      checks: { store: "fail", queue: "ok", artifacts: "ok" },
    });
  });
});

describe("OpenAPI document", () => {
  it("is generated from the contract and committed in sync", async () => {
    const { openApiDocument } = await import("./openapi.ts");
    const committed = JSON.parse(
      fs.readFileSync(path.resolve(import.meta.dirname, "../../../docs/api/openapi.json"), "utf8"),
    );
    expect(committed).toEqual(JSON.parse(JSON.stringify(openApiDocument())));
  });
});
