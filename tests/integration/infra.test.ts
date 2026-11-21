/**
 * Real-infrastructure integration tests. Opt-in:
 *   ARCHMAP_IT=1 DATABASE_URL=... REDIS_URL=... S3_* ... pnpm vitest run tests/integration
 * (infrastructure/docker-compose.yml exposes all three on 127.0.0.1.)
 * ARCHMAP_API_URL additionally runs an HTTP smoke test against a deployed API (fixtures source).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, CreateAnalysisResponse, AnalysisSummary } from "@archmap/contracts";
import { ArchmapGraph } from "@archmap/graph-schema";
import { FixtureSource, processAnalysis, type AnalysisRecord } from "@archmap/hosted";
import { BullQueue, redisConnection, startWorker } from "@archmap/hosted/bullmq";
import { PostgresStore, migrate } from "@archmap/hosted/postgres";
import { S3Artifacts } from "@archmap/hosted/s3";

const env = process.env;
const enabled = env.ARCHMAP_IT === "1";
const FIXTURES = path.resolve(import.meta.dirname, "../../fixtures");
const quiet = { info() {}, warn() {}, error() {} };

describe.runIf(enabled)("postgres + redis + s3", () => {
  const store = new PostgresStore(
    env.DATABASE_URL ?? "postgres://archmap:archmap-dev@127.0.0.1:55432/archmap",
  );
  const artifacts = new S3Artifacts({
    bucket: env.S3_BUCKET ?? "archmap-artifacts",
    region: "us-east-1",
    endpoint: env.S3_ENDPOINT ?? "http://127.0.0.1:58333",
    accessKeyId: env.S3_ACCESS_KEY_ID ?? "archmap-dev",
    secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "archmap-dev-secret-change-me",
  });
  const connection = redisConnection(env.REDIS_URL ?? "redis://127.0.0.1:56379/0");
  afterAll(() => store.close());

  const record = async (patch: Partial<AnalysisRecord> = {}): Promise<AnalysisRecord> => {
    const src = await new FixtureSource(FIXTURES).resolve(
      "archmap-fixtures",
      "circular",
      undefined,
    );
    const now = new Date();
    return {
      id: randomUUID(),
      owner: src.owner,
      repo: src.repo,
      ref: null,
      commit: src.commit,
      status: "queued",
      errorCode: null,
      errorMessage: null,
      managementVerifier: "a".repeat(64),
      clientKey: "b".repeat(64),
      cacheKey: randomUUID().replace(/-/g, "").padEnd(64, "0"),
      analyzerVersion: "0.1.0",
      schemaVersion: "1.0.0",
      artifactKey: null,
      stats: null,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 86_400_000),
      ...patch,
    };
  };

  it("survives idle-connection errors from the pool (Postgres restart)", () => {
    expect(() =>
      store.pool.emit("error", new Error("terminating connection due to administrator command")),
    ).not.toThrow();
  });

  it("migrations are idempotent", async () => {
    await migrate(store.pool);
    expect(await migrate(store.pool)).toEqual([]);
  });

  it("transition is an atomic compare-and-set under concurrency", async () => {
    await artifacts.ensureBucket();
    const rec = await record();
    await store.create(rec);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => store.transition(rec.id, ["queued"], "fetching")),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await store.get(rec.id))!.status).toBe("fetching");
    expect(await store.transition(rec.id, ["queued"], "cancelled")).toBeNull();
  });

  it("S3 round-trips and reports missing objects as null", async () => {
    const key = `it/${randomUUID()}.json`;
    await artifacts.put(key, Buffer.from('{"a":1}'), "application/json");
    expect((await artifacts.get(key))!.toString()).toBe('{"a":1}');
    await artifacts.delete(key);
    expect(await artifacts.get(key)).toBeNull();
  });

  it("BullMQ delivers a deduplicated job to the worker, which completes the pipeline", async () => {
    const rec = await record();
    await store.create(rec);
    const queue = new BullQueue(connection);
    const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "archmap-it-"));
    const deps = {
      store,
      artifacts,
      source: new FixtureSource(FIXTURES),
      limits: { ...DEFAULT_LIMITS },
      workRoot,
      log: quiet,
    };
    let runs = 0;
    const worker = startWorker(connection, 1, async (id, final) => {
      runs++;
      await processAnalysis(id, deps, { final });
    });
    try {
      await queue.enqueue(rec.id);
      await queue.enqueue(rec.id); // dedupe by jobId
      for (
        let i = 0;
        i < 100 && !["completed", "failed"].includes((await store.get(rec.id))!.status);
        i++
      )
        await new Promise((r) => setTimeout(r, 200));
      const done = (await store.get(rec.id))!;
      expect(done.status).toBe("completed");
      expect(runs).toBe(1);
      ArchmapGraph.parse(JSON.parse((await artifacts.get(done.artifactKey!))!.toString()));
    } finally {
      await worker.close();
      await queue.close();
    }
  }, 60_000);
});

describe.runIf(enabled && !!env.ARCHMAP_API_URL)("deployed API smoke test", () => {
  const base = env.ARCHMAP_API_URL!;
  const origin = env.ARCHMAP_WEB_ORIGIN ?? "http://localhost:3000";

  it("health endpoints respond", async () => {
    expect((await fetch(`${base}/health/live`)).status).toBe(200);
    const ready = await fetch(`${base}/health/ready`);
    expect(await ready.json()).toMatchObject({ status: "ok" });
  });

  it("analyzes a fixture end to end and deletes it with the management cookie", async () => {
    const res = await fetch(`${base}/v1/analyses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250)}`,
      },
      body: JSON.stringify({ repository: "archmap-fixtures/type-cycle" }),
    });
    expect([200, 202]).toContain(res.status);
    const created = CreateAnalysisResponse.parse(await res.json());
    const id = created.analysis.id;
    let status = created.analysis.status;
    for (
      let i = 0;
      i < 150 && !["completed", "completed_with_limitations", "failed"].includes(status);
      i++
    ) {
      await new Promise((r) => setTimeout(r, 200));
      status = AnalysisSummary.parse(
        await (await fetch(`${base}/v1/analyses/${id}`)).json(),
      ).status;
    }
    expect(status).toBe("completed");
    const graph = ArchmapGraph.parse(await (await fetch(`${base}/v1/analyses/${id}/graph`)).json());
    expect(graph.findings.map((f) => f.category)).toEqual(["type-cycle"]);
    if (created.canManage) {
      const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
      expect(
        (await fetch(`${base}/v1/analyses/${id}`, { method: "DELETE", headers: { origin } }))
          .status,
      ).toBe(401);
      expect(
        (
          await fetch(`${base}/v1/analyses/${id}`, {
            method: "DELETE",
            headers: { origin, cookie },
          })
        ).status,
      ).toBe(204);
      expect((await fetch(`${base}/v1/analyses/${id}`)).status).toBe(404);
    }
  }, 60_000);
});
