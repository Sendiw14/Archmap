import fs from "node:fs";
import { ANALYZER_VERSION } from "@archmap/analyzer";
import {
  FixtureSource,
  GitHubSource,
  MemoryArtifacts,
  MemoryQueue,
  MemoryStore,
  expireAnalyses,
  loadConfig,
  processAnalysis,
} from "@archmap/hosted";
import { buildApp, type ApiDeps } from "./app.ts";

const cfg = loadConfig();
const source =
  cfg.source === "fixtures"
    ? new FixtureSource(cfg.fixturesDir)
    : new GitHubSource({ token: cfg.githubToken });
const closers: (() => Promise<void>)[] = [];
let deps: ApiDeps;

if (cfg.mode === "memory") {
  // Offline, single-process mode: the real pipeline runs in-process. Data is lost on restart.
  const store = new MemoryStore();
  const artifacts = new MemoryArtifacts();
  const queue = new MemoryQueue();
  fs.mkdirSync(cfg.workDir, { recursive: true });
  deps = { store, artifacts, queue, source };
  const log = { info() {}, warn() {}, error: (o: object, m?: string) => console.error(m, o) };
  queue.handler = (id) =>
    processAnalysis(
      id,
      { store, artifacts, source, limits: cfg.limits, workRoot: cfg.workDir, log },
      { final: true },
    );
  const sweep = setInterval(() => void expireAnalyses({ store, artifacts, log }), 60_000);
  closers.push(async () => clearInterval(sweep));
} else {
  const { PostgresStore, migrate } = await import("@archmap/hosted/postgres");
  const { S3Artifacts } = await import("@archmap/hosted/s3");
  const { BullQueue, redisConnection } = await import("@archmap/hosted/bullmq");
  const store = new PostgresStore(cfg.databaseUrl!);
  await migrate(store.pool);
  const queue = new BullQueue(redisConnection(cfg.redisUrl!));
  const artifacts = new S3Artifacts(cfg.s3);
  if (cfg.s3.createBucket) await artifacts.ensureBucket();
  deps = { store, artifacts, queue, source };
  closers.push(
    () => queue.close(),
    () => store.close(),
  );
}

// Worker version must match: cache keys embed the analyzer version.
const app = await buildApp(deps, {
  ...cfg,
  analyzerVersion: ANALYZER_VERSION,
  logLevel: cfg.logLevel,
});
const shutdown = async () => {
  await app.close();
  for (const c of closers) await c().catch(() => {});
  process.exit(0);
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
await app.listen({ port: cfg.port, host: cfg.host });
app.log.info(
  { mode: cfg.mode, source: cfg.source, importsEnabled: cfg.importsEnabled },
  "archmap api ready",
);
