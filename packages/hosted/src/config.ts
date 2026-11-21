import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { DEFAULT_LIMITS } from "@archmap/contracts";
import type { Limits } from "./pipeline.ts";

const bool = (def: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const Env = z.object({
  ARCHMAP_MODE: z.enum(["memory", "production"]).default("production"),
  ARCHMAP_SOURCE: z.enum(["github", "fixtures"]).optional(),
  ARCHMAP_FIXTURES_DIR: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_CREATE_BUCKET: bool(false),
  GITHUB_TOKEN: z.string().optional(),
  WEB_ORIGINS: z.string().default("http://localhost:3000"),
  CLIENT_KEY_SECRET: z.string().optional(),
  IMPORTS_ENABLED: bool(true),
  TRUST_PROXY: z.string().optional(),
  SECURE_COOKIES: z.enum(["true", "false"]).optional(),
  WORK_DIR: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type HostedConfig = ReturnType<typeof loadConfig>;

const LIMIT_KEYS = Object.keys(DEFAULT_LIMITS) as (keyof typeof DEFAULT_LIMITS)[];
const envName = (k: string) => `ARCHMAP_LIMIT_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`;

/** Parse and validate environment. Throws a message that names variables, never values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Env.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `Invalid configuration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  const e = parsed.data;
  const production = e.ARCHMAP_MODE === "production";

  const limits: Limits = { ...DEFAULT_LIMITS };
  for (const k of LIMIT_KEYS) {
    const raw = env[envName(k)];
    if (raw === undefined) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid configuration: ${envName(k)}`);
    limits[k] = n;
  }

  const missing: string[] = [];
  if (production) {
    for (const k of ["DATABASE_URL", "REDIS_URL", "S3_BUCKET", "CLIENT_KEY_SECRET"] as const)
      if (!e[k]) missing.push(k);
    if (e.CLIENT_KEY_SECRET && e.CLIENT_KEY_SECRET.length < 32)
      missing.push("CLIENT_KEY_SECRET (>= 32 chars)");
  }
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(", ")}`);

  const trust = e.TRUST_PROXY;
  const trustProxy: boolean | number | string =
    trust === undefined || trust === "false"
      ? false
      : trust === "true"
        ? true
        : /^\d+$/.test(trust)
          ? Number(trust)
          : trust;

  return {
    mode: e.ARCHMAP_MODE,
    source: e.ARCHMAP_SOURCE ?? (production ? "github" : "fixtures"),
    fixturesDir:
      e.ARCHMAP_FIXTURES_DIR ?? fileURLToPath(new URL("../../../fixtures", import.meta.url)),
    port: e.PORT,
    host: e.HOST,
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL,
    s3: {
      bucket: e.S3_BUCKET ?? "",
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      createBucket: e.S3_CREATE_BUCKET,
    },
    githubToken: e.GITHUB_TOKEN,
    allowedOrigins: e.WEB_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    clientKeySecret: e.CLIENT_KEY_SECRET ?? "archmap-memory-mode-not-a-secret-000000",
    importsEnabled: e.IMPORTS_ENABLED,
    trustProxy,
    secureCookies: e.SECURE_COOKIES ? e.SECURE_COOKIES === "true" : production,
    workDir: e.WORK_DIR ?? path.join(os.tmpdir(), "archmap-work"),
    logLevel: e.LOG_LEVEL,
    limits,
  };
}
