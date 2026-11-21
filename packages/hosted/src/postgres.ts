import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, count, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { char, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import pg from "pg";
import { RESULT_STATUSES, TERMINAL_STATUSES, type JobStatus } from "@archmap/contracts";
import type { AnalysisRecord, AnalysisStore, RecordPatch } from "./ports.ts";

export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  ref: text("ref"),
  commit: char("commit_sha", { length: 40 }).notNull(),
  status: text("status").$type<JobStatus>().notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  managementVerifier: char("management_verifier", { length: 64 }),
  clientKey: char("client_key", { length: 64 }).notNull(),
  cacheKey: char("cache_key", { length: 64 }).notNull(),
  analyzerVersion: text("analyzer_version").notNull(),
  schemaVersion: text("schema_version").notNull(),
  artifactKey: text("artifact_key"),
  stats: jsonb("stats").$type<AnalysisRecord["stats"]>(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

const MIGRATIONS = fileURLToPath(new URL("../migrations", import.meta.url));

/** Apply pending SQL migrations in order, under an advisory lock (safe with concurrent starters). */
export async function migrate(pool: pg.Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock(424242)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const done = new Set(
      (await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map(
        (r) => r.name,
      ),
    );
    for (const file of fs
      .readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (done.has(file)) continue;
      await client.query("BEGIN");
      try {
        await client.query(fs.readFileSync(path.join(MIGRATIONS, file), "utf8"));
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(424242)").catch(() => {});
    client.release();
  }
  return applied;
}

export class PostgresStore implements AnalysisStore {
  readonly pool: pg.Pool;
  private readonly db: NodePgDatabase;
  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    // Idle clients emit "error" when the server goes away; without a listener Node crashes the process.
    // The pool discards the broken client; requests fail (readiness reports 503) until Postgres returns.
    this.pool.on("error", (err) =>
      console.error(
        JSON.stringify({ level: "error", msg: "postgres idle client error", err: err.message }),
      ),
    );
    this.db = drizzle(this.pool);
  }

  async create(rec: AnalysisRecord) {
    await this.db.insert(analyses).values(rec);
  }
  async get(id: string) {
    const [row] = await this.db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
    return row ?? null;
  }
  async findReusable(cacheKey: string, now: Date) {
    const [row] = await this.db
      .select()
      .from(analyses)
      .where(
        and(
          eq(analyses.cacheKey, cacheKey),
          inArray(analyses.status, [...RESULT_STATUSES]),
          sql`${analyses.expiresAt} > ${now}`,
        ),
      )
      .orderBy(desc(analyses.createdAt))
      .limit(1);
    return row ?? null;
  }
  async transition(id: string, from: readonly JobStatus[], to: JobStatus, patch: RecordPatch = {}) {
    const [row] = await this.db
      .update(analyses)
      .set({ ...patch, status: to, updatedAt: new Date() })
      .where(and(eq(analyses.id, id), inArray(analyses.status, [...from])))
      .returning();
    return row ?? null;
  }
  async delete(id: string) {
    const rows = await this.db
      .delete(analyses)
      .where(eq(analyses.id, id))
      .returning({ id: analyses.id });
    return rows.length > 0;
  }
  async countCreatedByClientSince(clientKey: string, since: Date) {
    const [r] = await this.db
      .select({ n: count() })
      .from(analyses)
      .where(and(eq(analyses.clientKey, clientKey), gte(analyses.createdAt, since)));
    return r?.n ?? 0;
  }
  async listExpired(now: Date, limit: number) {
    return this.db
      .select()
      .from(analyses)
      .where(and(ne(analyses.status, "expired"), lt(analyses.expiresAt, now)))
      .limit(limit);
  }
  async countActive() {
    const active = (["queued", "fetching", "analyzing", "persisting"] as JobStatus[]).filter(
      (s) => !TERMINAL_STATUSES.includes(s),
    );
    const [r] = await this.db
      .select({ n: count() })
      .from(analyses)
      .where(inArray(analyses.status, active));
    return r?.n ?? 0;
  }
  async purge(before: Date) {
    const rows = await this.db
      .delete(analyses)
      .where(and(eq(analyses.status, "expired"), lt(analyses.expiresAt, before)))
      .returning({ id: analyses.id });
    return rows.length;
  }
  async ping() {
    await this.pool.query("SELECT 1");
  }
  async close() {
    await this.pool.end();
  }
}
