/** In-process adapters for offline development, demos and tests. Not for production. */
import { TERMINAL_STATUSES, RESULT_STATUSES, type JobStatus } from "@archmap/contracts";
import type {
  AnalysisRecord,
  AnalysisStore,
  ArtifactStore,
  JobQueue,
  RecordPatch,
} from "./ports.ts";

const clone = (r: AnalysisRecord): AnalysisRecord => structuredClone(r);

export class MemoryStore implements AnalysisStore {
  private readonly rows = new Map<string, AnalysisRecord>();

  async create(rec: AnalysisRecord) {
    if (this.rows.has(rec.id)) throw new Error("duplicate id");
    this.rows.set(rec.id, clone(rec));
  }
  async get(id: string) {
    const r = this.rows.get(id);
    return r ? clone(r) : null;
  }
  async findReusable(cacheKey: string, now: Date) {
    const hits = [...this.rows.values()]
      .filter(
        (r) => r.cacheKey === cacheKey && RESULT_STATUSES.includes(r.status) && r.expiresAt > now,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return hits[0] ? clone(hits[0]) : null;
  }
  async transition(id: string, from: readonly JobStatus[], to: JobStatus, patch: RecordPatch = {}) {
    const r = this.rows.get(id);
    if (!r || !from.includes(r.status)) return null;
    Object.assign(r, patch, { status: to, updatedAt: new Date() });
    return clone(r);
  }
  async delete(id: string) {
    return this.rows.delete(id);
  }
  async countCreatedByClientSince(clientKey: string, since: Date) {
    return [...this.rows.values()].filter((r) => r.clientKey === clientKey && r.createdAt >= since)
      .length;
  }
  async listExpired(now: Date, limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.status !== "expired" && r.expiresAt < now)
      .slice(0, limit)
      .map(clone);
  }
  async countActive() {
    return [...this.rows.values()].filter((r) => !TERMINAL_STATUSES.includes(r.status)).length;
  }
  async purge(before: Date) {
    let n = 0;
    for (const [id, r] of this.rows)
      if (r.status === "expired" && r.expiresAt < before) {
        this.rows.delete(id);
        n++;
      }
    return n;
  }
  async ping() {}
}

export class MemoryArtifacts implements ArtifactStore {
  readonly objects = new Map<string, Buffer>();
  async put(key: string, body: Buffer) {
    this.objects.set(key, Buffer.from(body));
  }
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async ping() {}
}

/**
 * Runs jobs in-process, one at a time, after the current tick.
 * Mirrors BullMQ semantics we rely on: jobId dedupe, retries via handler return.
 */
export class MemoryQueue implements JobQueue {
  private readonly pending = new Set<string>();
  private chain: Promise<void> = Promise.resolve();
  handler: ((id: string) => Promise<void>) | null = null;

  async enqueue(id: string) {
    if (this.pending.has(id)) return;
    this.pending.add(id);
    this.chain = this.chain.then(async () => {
      if (!this.pending.has(id)) return;
      this.pending.delete(id);
      try {
        await this.handler?.(id);
      } catch {
        /* handler records failures in the store */
      }
    });
  }
  async remove(id: string) {
    this.pending.delete(id);
  }
  /** Resolves when every queued job has finished (tests). */
  idle() {
    return this.chain;
  }
  async ping() {}
}
