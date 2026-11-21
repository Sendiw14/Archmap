import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { JobQueue } from "./ports.ts";

export const QUEUE_NAME = "archmap-analyses";
export const JOB_ATTEMPTS = 3;

export function redisConnection(url: string): ConnectionOptions {
  const u = new URL(url);
  if (u.protocol !== "redis:" && u.protocol !== "rediss:")
    throw new Error("REDIS_URL must be redis:// or rediss://");
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
    ...(u.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

export class BullQueue implements JobQueue {
  readonly queue: Queue;
  constructor(connection: ConnectionOptions) {
    this.queue = new Queue(QUEUE_NAME, { connection });
  }
  async enqueue(id: string) {
    await this.queue.add(
      "analyze",
      { id },
      {
        jobId: id, // dedupe: re-adding an existing id is a no-op
        attempts: JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    );
  }
  async remove(id: string) {
    try {
      await this.queue.remove(id);
    } catch {
      /* active (locked) jobs cannot be removed; the worker observes the cancelled status instead */
    }
  }
  async ping() {
    await this.queue.getJobCounts("waiting"); // round-trip to Redis
  }
  async close() {
    await this.queue.close();
  }
}

/** BullMQ worker; `final` tells the handler whether this is the last attempt. */
export function startWorker(
  connection: ConnectionOptions,
  concurrency: number,
  handle: (id: string, final: boolean) => Promise<void>,
) {
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      const attempts = job.opts.attempts ?? 1;
      await handle(String(job.data.id), job.attemptsMade + 1 >= attempts);
    },
    { connection, concurrency, lockDuration: 60_000, maxStalledCount: 2 },
  );
}
