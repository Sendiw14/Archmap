import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LIMITS, TERMINAL_STATUSES, type JobStatus } from "@archmap/contracts";
import { ArchmapGraph } from "@archmap/graph-schema";
import { safeExtract } from "./extract.ts";
import {
  HostedError,
  type AnalysisRecord,
  type AnalysisStore,
  type ArtifactStore,
  type SourceProvider,
} from "./ports.ts";

export type Limits = { -readonly [K in keyof typeof DEFAULT_LIMITS]: number };

export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface PipelineDeps {
  store: AnalysisStore;
  artifacts: ArtifactStore;
  source: SourceProvider;
  limits: Limits;
  /** Directory for per-job scratch space (deleted after each job). */
  workRoot: string;
  log: Logger;
  /** How often to check for cancellation while working. */
  pollMs?: number;
}

export const CHILD_SCRIPT = fileURLToPath(new URL("./analyze-child.ts", import.meta.url));

/** Identity for result reuse: repository + immutable commit + analyzer/schema versions + config. */
export function cacheKeyFor(
  owner: string,
  repo: string,
  commit: string,
  analyzerVersion: string,
  schemaVersion: string,
  limits: Limits,
) {
  const config = JSON.stringify({ maxFiles: limits.maxFiles, maxFileBytes: limits.maxFileBytes });
  return createHash("sha256")
    .update(
      `${owner.toLowerCase()}/${repo.toLowerCase()}@${commit}|${analyzerVersion}|${schemaVersion}|${config}`,
    )
    .digest("hex");
}

const ACTIVE: JobStatus[] = ["queued", "fetching", "analyzing", "persisting"];

class Cancelled extends Error {}

function runChild(args: string[], limits: Limits, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [`--max-old-space-size=${limits.workerMemoryMb}`, CHILD_SCRIPT, ...args],
      { env: {}, stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < 4096) stderr += d.toString();
    });
    let reason: Error | null = null;
    const timer = setTimeout(() => {
      reason = new HostedError(
        "analysis_timeout",
        `Analysis exceeded ${Math.round(limits.analysisTimeoutMs / 1000)} s`,
      );
      child.kill("SIGKILL");
    }, limits.analysisTimeoutMs);
    const onAbort = () => {
      reason = new Cancelled();
      child.kill("SIGKILL");
    };
    signal.addEventListener("abort", onAbort, { once: true });
    child.on("error", (err) => {
      reason ??= err;
    });
    child.on("close", (code, sig) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      if (reason) return reject(reason);
      if (code === 0) return resolve();
      if (/heap out of memory/i.test(stderr) || sig === "SIGABRT" || code === 134)
        return reject(
          new HostedError(
            "limit_exceeded",
            `Analysis exceeded the ${limits.workerMemoryMb} MiB memory budget`,
          ),
        );
      reject(new Error(`analysis process exited with ${code ?? sig}: ${stderr.slice(0, 500)}`));
    });
  });
}

/**
 * Process one analysis job. Idempotent: terminal jobs are skipped; a job found mid-flight
 * (worker crashed) is reset to queued and re-run from the start.
 * Throws only to request a retry (retryable error and `final` is false).
 */
export async function processAnalysis(
  id: string,
  deps: PipelineDeps,
  opts: { final: boolean },
): Promise<void> {
  const { store, artifacts, source, limits, log } = deps;
  let rec = await store.get(id);
  if (!rec || TERMINAL_STATUSES.includes(rec.status)) return;
  if (rec.status !== "queued") {
    log.warn({ id, status: rec.status }, "recovering interrupted job");
    rec = await store.transition(id, ["fetching", "analyzing", "persisting"], "queued");
    if (!rec) return;
  }

  const work = fs.mkdtempSync(path.join(deps.workRoot, "job-"));
  const controller = new AbortController();
  const watcher = setInterval(async () => {
    try {
      const cur = await store.get(id);
      if (!cur || cur.status === "cancelled") controller.abort();
    } catch {
      /* transient store error: keep working, next poll retries */
    }
  }, deps.pollMs ?? 1000);

  const step = async (from: JobStatus, to: JobStatus, patch = {}) => {
    const next = await store.transition(id, [from], to, patch);
    if (!next) throw new Cancelled();
    log.info({ id, status: to }, "status");
    return next;
  };
  const started = Date.now();

  try {
    await step("queued", "fetching", { attempts: rec.attempts + 1 });
    const archive = await source
      .download(
        { owner: rec.owner, repo: rec.repo, commit: rec.commit, ref: rec.ref, sizeKb: 0 },
        limits.maxArchiveBytes,
        controller.signal,
      )
      .catch((err) => {
        if (controller.signal.aborted) throw new Cancelled();
        throw err;
      });
    const srcDir = path.join(work, "src");
    const extracted = await safeExtract(archive, srcDir, limits);

    await step("fetching", "analyzing");
    const out = path.join(work, "graph.json");
    await runChild(
      [
        srcDir,
        out,
        String(limits.maxFiles),
        String(limits.maxFileBytes),
        `${rec.owner}/${rec.repo}`,
        rec.commit,
      ],
      limits,
      controller.signal,
    );
    if (fs.statSync(out).size > limits.maxGraphBytes)
      throw new HostedError("limit_exceeded", "Analysis result exceeds the output size limit");
    const graph = ArchmapGraph.parse(JSON.parse(fs.readFileSync(out, "utf8")));
    const skipped = extracted.skippedLinks + extracted.skippedLarge + extracted.skippedOther;
    if (skipped > 0) {
      graph.diagnostics.push({
        code: "archive-entries-skipped",
        severity: extracted.skippedLarge > 0 ? "warning" : "info",
        message: `Archive entries not extracted: ${extracted.skippedLinks} links, ${extracted.skippedLarge} files over ${limits.maxFileBytes} bytes, ${extracted.skippedOther} other`,
      });
      if (extracted.skippedLarge > 0) graph.metadata.status = "completed_with_limitations";
    }

    await step("analyzing", "persisting");
    const key = `graphs/${id}.json`;
    await artifacts.put(key, Buffer.from(JSON.stringify(graph)), "application/json");
    const final = graph.metadata.status === "failed" ? "failed" : graph.metadata.status;
    const done = await store.transition(id, ["persisting"], final, {
      artifactKey: key,
      stats: {
        files: graph.metadata.counts.filesAnalyzed,
        edges: graph.edges.length,
        findings: graph.findings.length,
      },
      ...(final === "failed"
        ? { errorCode: "internal", errorMessage: "Analysis reported failure" }
        : {}),
    });
    if (!done) await artifacts.delete(key); // cancelled/deleted while persisting
    log.info(
      { id, status: final, ms: Date.now() - started, files: graph.metadata.counts.filesAnalyzed },
      "job finished",
    );
  } catch (err) {
    if (err instanceof Cancelled || controller.signal.aborted) {
      log.info({ id }, "job cancelled");
      return;
    }
    const hosted = err instanceof HostedError ? err : null;
    if (hosted?.retryable && !opts.final) {
      await store.transition(id, ["fetching", "analyzing", "persisting"], "queued");
      log.warn({ id, code: hosted.code }, "retrying job");
      throw err;
    }
    log.error(
      { id, code: hosted?.code ?? "internal", err: hosted ? undefined : String(err) },
      "job failed",
    );
    await store.transition(id, ACTIVE, "failed", {
      errorCode: hosted && isJobError(hosted.code) ? hosted.code : "internal",
      errorMessage: hosted ? hosted.message : "Analysis failed unexpectedly",
    });
  } finally {
    clearInterval(watcher);
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const JOB_ERRORS = new Set([
  "repository_not_found",
  "repository_not_public",
  "ref_not_found",
  "github_unavailable",
  "limit_exceeded",
  "analysis_timeout",
  "internal",
]);
const isJobError = (c: string) => JOB_ERRORS.has(c);

/** Expire records past retention: delete artifacts, keep a tombstone; purge old tombstones. */
export async function expireAnalyses(
  deps: Pick<PipelineDeps, "store" | "artifacts" | "log">,
  now = new Date(),
  tombstoneDays = 7,
): Promise<{ expired: number; purged: number }> {
  let expired = 0;
  for (;;) {
    const batch: AnalysisRecord[] = await deps.store.listExpired(now, 100);
    if (batch.length === 0) break;
    let progressed = false;
    for (const r of batch) {
      if (r.artifactKey) await deps.artifacts.delete(r.artifactKey);
      const from = TERMINAL_STATUSES.filter((s) => s !== "expired").concat("queued");
      if (await deps.store.transition(r.id, from, "expired", { artifactKey: null })) {
        expired++;
        progressed = true;
      }
    }
    if (!progressed) break; // remaining rows are mid-flight; next sweep handles them
  }
  const purged = await deps.store.purge(new Date(now.getTime() - tombstoneDays * 86_400_000));
  if (expired || purged) deps.log.info({ expired, purged }, "retention sweep");
  return { expired, purged };
}
