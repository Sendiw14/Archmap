import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS } from "@archmap/contracts";
import { ArchmapGraph } from "@archmap/graph-schema";
import {
  FixtureSource,
  HostedError,
  MemoryArtifacts,
  MemoryStore,
  expireAnalyses,
  processAnalysis,
  safeExtract,
  type AnalysisRecord,
  type Limits,
  type PipelineDeps,
  type SourceProvider,
} from "./index.ts";

const FIXTURES = path.resolve(import.meta.dirname, "../../../fixtures");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "archmap-hosted-"));
const quiet = { info() {}, warn() {}, error() {} };

// ---- minimal ustar writer for adversarial archives ----
interface Entry {
  name: string;
  type?: "0" | "1" | "2" | "5";
  body?: Buffer;
  link?: string;
  size?: number;
}
function tarGz(entries: Entry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const body = e.body ?? Buffer.alloc(0);
    const h = Buffer.alloc(512);
    h.write(e.name.slice(0, 100), 0, "utf8");
    h.write("0000644\0", 100);
    h.write("0000000\0", 108);
    h.write("0000000\0", 116);
    h.write((e.size ?? body.length).toString(8).padStart(11, "0") + "\0", 124);
    h.write("00000000000\0", 136);
    h.write("        ", 148);
    h.write(e.type ?? "0", 156);
    if (e.link) h.write(e.link, 157);
    h.write("ustar\0", 257);
    h.write("00", 263);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
    blocks.push(h, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

const LIM = { maxExtractedBytes: 1_000_000, maxArchiveEntries: 50, maxFileBytes: 200_000 };

describe("safeExtract", () => {
  it("extracts regular files with the top directory stripped", async () => {
    const dest = tmp();
    const r = await safeExtract(
      tarGz([
        { name: "top/", type: "5" },
        { name: "top/a.ts", body: Buffer.from("x") },
      ]),
      dest,
      LIM,
    );
    expect(fs.readFileSync(path.join(dest, "a.ts"), "utf8")).toBe("x");
    expect(r.files).toBe(1);
  });
  it("never writes outside the destination (.., absolute)", async () => {
    const parent = tmp();
    const dest = path.join(parent, "out");
    await safeExtract(
      tarGz([
        { name: "top/../../escape.ts", body: Buffer.from("x") },
        { name: "/abs-escape.ts", body: Buffer.from("x") },
        { name: "top/ok.ts", body: Buffer.from("x") },
      ]),
      dest,
      LIM,
    ).catch(() => {});
    expect(fs.existsSync(path.join(parent, "escape.ts"))).toBe(false);
    expect(fs.existsSync(path.join(path.dirname(parent), "escape.ts"))).toBe(false);
    expect(fs.existsSync("/abs-escape.ts")).toBe(false);
  });
  it("skips symlinks and hard links", async () => {
    const dest = tmp();
    const r = await safeExtract(
      tarGz([
        { name: "top/link", type: "2", link: "/etc/passwd" },
        { name: "top/hard", type: "1", link: "top/x" },
        { name: "top/x.ts", body: Buffer.from("x") },
      ]),
      dest,
      LIM,
    );
    expect(r.skippedLinks).toBe(2);
    expect(fs.existsSync(path.join(dest, "link"))).toBe(false);
    expect(fs.existsSync(path.join(dest, "hard"))).toBe(false);
  });
  it("skips oversized files without failing", async () => {
    const dest = tmp();
    const r = await safeExtract(
      tarGz([{ name: "top/big.ts", body: Buffer.alloc(300_000) }]),
      dest,
      LIM,
    );
    expect(r.skippedLarge).toBe(1);
    expect(fs.existsSync(path.join(dest, "big.ts"))).toBe(false);
  });
  it("aborts when total extracted bytes exceed the budget (decompression bomb)", async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      name: `top/f${i}.ts`,
      body: Buffer.alloc(190_000),
    }));
    await expect(safeExtract(tarGz(many), tmp(), LIM)).rejects.toMatchObject({
      code: "limit_exceeded",
    });
  });
  it("aborts when the entry count exceeds the budget", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      name: `top/f${i}.ts`,
      body: Buffer.from("x"),
    }));
    await expect(safeExtract(tarGz(many), tmp(), LIM)).rejects.toMatchObject({
      code: "limit_exceeded",
    });
  });
  it("rejects garbage input", async () => {
    await expect(safeExtract(Buffer.from("not a tarball"), tmp(), LIM)).rejects.toBeInstanceOf(
      HostedError,
    );
  });
});

// ---- pipeline ----

function deps(
  overrides: Partial<PipelineDeps> = {},
  limits: Partial<Limits> = {},
): PipelineDeps & { store: MemoryStore; artifacts: MemoryArtifacts } {
  return {
    store: new MemoryStore(),
    artifacts: new MemoryArtifacts(),
    source: new FixtureSource(FIXTURES),
    limits: { ...DEFAULT_LIMITS, ...limits },
    workRoot: tmp(),
    log: quiet,
    pollMs: 10,
    ...overrides,
  } as PipelineDeps & { store: MemoryStore; artifacts: MemoryArtifacts };
}

async function seed(d: PipelineDeps, repo = "circular", patch: Partial<AnalysisRecord> = {}) {
  const r = await d.source.resolve("archmap-fixtures", repo, undefined);
  const now = new Date();
  const rec: AnalysisRecord = {
    id: randomUUID(),
    owner: r.owner,
    repo: r.repo,
    ref: null,
    commit: r.commit,
    status: "queued",
    errorCode: null,
    errorMessage: null,
    managementVerifier: null,
    clientKey: "c".repeat(64),
    cacheKey: "k".repeat(64),
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
  await d.store.create(rec);
  return rec;
}

describe("processAnalysis", () => {
  it("runs fetch -> extract -> analyze (child process) -> persist", async () => {
    const d = deps();
    const rec = await seed(d);
    await processAnalysis(rec.id, d, { final: true });
    const done = (await d.store.get(rec.id))!;
    expect(done.status).toBe("completed");
    expect(done.stats).toEqual({ files: 4, edges: 4, findings: 1 });
    const graph = ArchmapGraph.parse(
      JSON.parse(d.artifacts.objects.get(done.artifactKey!)!.toString()),
    );
    expect(graph.metadata.repository).toEqual({
      name: "archmap-fixtures/circular",
      commit: rec.commit,
    });
    expect(graph.findings[0]!.category).toBe("runtime-cycle");
    expect(fs.readdirSync(d.workRoot)).toEqual([]); // scratch cleaned
  }, 30_000);

  it("is idempotent for terminal jobs and recovers interrupted ones", async () => {
    const d = deps();
    const rec = await seed(d, "esm", { status: "analyzing" });
    await processAnalysis(rec.id, d, { final: true });
    expect((await d.store.get(rec.id))!.status).toBe("completed");
    const before = d.artifacts.objects.size;
    await processAnalysis(rec.id, d, { final: true });
    expect(d.artifacts.objects.size).toBe(before);
  }, 30_000);

  it("stops when cancelled mid-flight and cleans up", async () => {
    let started!: () => void;
    const begun = new Promise<void>((r) => (started = r));
    const slow: SourceProvider = {
      resolve: (o, r, ref) => new FixtureSource(FIXTURES).resolve(o, r, ref),
      download: (_r, _m, signal) =>
        new Promise((_, reject) => {
          started();
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    };
    const d = deps({ source: slow });
    const rec = await seed(d);
    const run = processAnalysis(rec.id, d, { final: true });
    await begun;
    await d.store.transition(rec.id, ["fetching"], "cancelled");
    await run;
    expect((await d.store.get(rec.id))!.status).toBe("cancelled");
    expect(d.artifacts.objects.size).toBe(0);
    expect(fs.readdirSync(d.workRoot)).toEqual([]);
  }, 30_000);

  it("fails with analysis_timeout when the child exceeds its budget", async () => {
    const d = deps({}, { analysisTimeoutMs: 1 });
    const rec = await seed(d);
    await processAnalysis(rec.id, d, { final: true });
    expect(await d.store.get(rec.id)).toMatchObject({
      status: "failed",
      errorCode: "analysis_timeout",
    });
  }, 30_000);

  it("fails with limit_exceeded for oversized archives", async () => {
    const d = deps({}, { maxArchiveBytes: 10 });
    const rec = await seed(d);
    await processAnalysis(rec.id, d, { final: true });
    expect(await d.store.get(rec.id)).toMatchObject({
      status: "failed",
      errorCode: "limit_exceeded",
    });
  }, 30_000);

  it("retries transient errors, then fails on the final attempt", async () => {
    const flaky: SourceProvider = {
      resolve: (o, r, ref) => new FixtureSource(FIXTURES).resolve(o, r, ref),
      download: async () => {
        throw new HostedError("github_unavailable", "down", true);
      },
    };
    const d = deps({ source: flaky });
    const rec = await seed(d);
    await expect(processAnalysis(rec.id, d, { final: false })).rejects.toMatchObject({
      code: "github_unavailable",
    });
    expect((await d.store.get(rec.id))!.status).toBe("queued");
    await processAnalysis(rec.id, d, { final: true });
    expect(await d.store.get(rec.id)).toMatchObject({
      status: "failed",
      errorCode: "github_unavailable",
      attempts: 2,
    });
  }, 30_000);

  it("never leaks internal error details", async () => {
    const broken: SourceProvider = {
      resolve: (o, r, ref) => new FixtureSource(FIXTURES).resolve(o, r, ref),
      download: async () => {
        throw new Error("ECONNRESET at /internal/path secret=abc");
      },
    };
    const d = deps({ source: broken });
    const rec = await seed(d);
    await processAnalysis(rec.id, d, { final: true });
    expect(await d.store.get(rec.id)).toMatchObject({
      status: "failed",
      errorCode: "internal",
      errorMessage: "Analysis failed unexpectedly",
    });
  });
});

describe("expireAnalyses", () => {
  it("deletes artifacts, tombstones records, then purges old tombstones", async () => {
    const d = deps();
    const rec = await seed(d);
    await processAnalysis(rec.id, d, { final: true });
    const key = (await d.store.get(rec.id))!.artifactKey!;
    const later = new Date(Date.now() + 2 * 86_400_000);
    expect(await expireAnalyses(d, later)).toEqual({ expired: 1, purged: 0 });
    expect(d.artifacts.objects.has(key)).toBe(false);
    expect((await d.store.get(rec.id))!.status).toBe("expired");
    expect(await expireAnalyses(d, new Date(later.getTime() + 8 * 86_400_000))).toEqual({
      expired: 0,
      purged: 1,
    });
    expect(await d.store.get(rec.id)).toBeNull();
  }, 30_000);
});

describe("FixtureSource", () => {
  it("only serves known fixture directories", async () => {
    const s = new FixtureSource(FIXTURES);
    await expect(s.resolve("someone", "circular", undefined)).rejects.toMatchObject({
      code: "repository_not_found",
    });
    await expect(s.resolve("archmap-fixtures", "..", undefined)).rejects.toMatchObject({
      code: "repository_not_found",
    });
    const a = await s.resolve("archmap-fixtures", "circular", undefined);
    expect(a.commit).toMatch(/^[0-9a-f]{40}$/);
    expect((await s.resolve("archmap-fixtures", "circular", undefined)).commit).toBe(a.commit);
  });
});
