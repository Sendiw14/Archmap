/**
 * Production worker: consumes BullMQ jobs, runs the analysis pipeline, sweeps expired results.
 * Run with a read-only root filesystem and a tmpfs WORK_DIR (see infrastructure/docker-compose.yml).
 */
import fs from "node:fs";
import { BullQueue, redisConnection, startWorker } from "@archmap/hosted/bullmq";
import { PostgresStore, migrate } from "@archmap/hosted/postgres";
import { S3Artifacts } from "@archmap/hosted/s3";
import {
  FixtureSource,
  GitHubSource,
  expireAnalyses,
  loadConfig,
  processAnalysis,
} from "@archmap/hosted";

const cfg = loadConfig();
if (cfg.mode !== "production")
  throw new Error("The worker runs in production mode only; use the API's memory mode offline");

const log = {
  info: (o: object, m?: string) =>
    console.log(JSON.stringify({ level: "info", msg: m, ...o, time: Date.now() })),
  warn: (o: object, m?: string) =>
    console.log(JSON.stringify({ level: "warn", msg: m, ...o, time: Date.now() })),
  error: (o: object, m?: string) =>
    console.error(JSON.stringify({ level: "error", msg: m, ...o, time: Date.now() })),
};

const store = new PostgresStore(cfg.databaseUrl!);
await migrate(store.pool);
const artifacts = new S3Artifacts(cfg.s3);
if (cfg.s3.createBucket) await artifacts.ensureBucket();
const source =
  cfg.source === "fixtures"
    ? new FixtureSource(cfg.fixturesDir)
    : new GitHubSource({ token: cfg.githubToken });
fs.mkdirSync(cfg.workDir, { recursive: true });
const connection = redisConnection(cfg.redisUrl!);
const queue = new BullQueue(connection);

const deps = { store, artifacts, source, limits: cfg.limits, workRoot: cfg.workDir, log };
const worker = startWorker(connection, cfg.limits.workerConcurrency, (id, final) =>
  processAnalysis(id, deps, { final }),
);
worker.on("failed", (job, err) =>
  log.warn({ id: job?.id, err: err.message }, "job attempt failed"),
);

// Requeue jobs whose queue entry was lost (e.g. Redis flushed) is out of scope; stalled jobs are
// re-delivered by BullMQ and processAnalysis resets interrupted records to "queued".
const sweep = setInterval(
  () =>
    void expireAnalyses({ store, artifacts, log }).catch((e) =>
      log.error({ err: String(e) }, "sweep failed"),
    ),
  5 * 60_000,
);
void expireAnalyses({ store, artifacts, log });

const shutdown = async () => {
  clearInterval(sweep);
  await worker.close(); // waits for active jobs
  await queue.close();
  await store.close();
  process.exit(0);
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
log.info({ concurrency: cfg.limits.workerConcurrency, source: cfg.source }, "archmap worker ready");
