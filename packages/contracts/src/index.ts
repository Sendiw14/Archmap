/**
 * ARCHMAP hosted API contract (v1). Shared by apps/api, apps/worker and apps/web.
 * Graph payloads use @archmap/graph-schema; edge direction is importer -> imported.
 */
import { z } from "zod";

export const API_VERSION = "v1";

// ---------- repository identity ----------

/** GitHub owner: 1-39 chars, alphanumeric or single hyphens, no leading/trailing hyphen. */
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
/** GitHub repository name: 1-100 chars of [A-Za-z0-9._-], not "." or "..". */
const REPO_RE = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;
/** Git ref we accept: branch/tag name or 40-hex sha. No "..", no control chars, no leading "-". */
const REF_RE = /^(?!-)(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9._\/-]{1,200}$/;

export interface RepositoryId {
  owner: string;
  repo: string;
}

/**
 * Parse user input into a GitHub owner/repo. Accepts "owner/repo",
 * "github.com/owner/repo", "https://github.com/owner/repo(.git)(/tree/...)".
 * Rejects every other host and scheme. Returns null when invalid.
 */
export function parseRepositoryInput(input: string): RepositoryId | null {
  let s = input.trim();
  if (s.length === 0 || s.length > 300) return null;
  if (/^https?:\/\//i.test(s)) {
    let url: URL;
    try {
      url = new URL(s);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (
      url.hostname.toLowerCase() !== "github.com" &&
      url.hostname.toLowerCase() !== "www.github.com"
    )
      return null;
    if (url.username || url.password || url.port) return null;
    s = url.pathname;
  } else if (/^(www\.)?github\.com\//i.test(s)) {
    s = s.replace(/^(www\.)?github\.com/i, "");
  } else if (s.includes(":") || s.includes("@")) {
    return null;
  }
  const parts = s.replace(/^\/+/, "").split("/");
  const owner = parts[0] ?? "";
  const repo = (parts[1] ?? "").replace(/\.git$/i, "");
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo)) return null;
  return { owner, repo };
}

export const CreateAnalysisRequest = z.object({
  repository: z.string().min(1).max(300),
  ref: z.string().regex(REF_RE, "Invalid branch, tag or commit").optional(),
});
export type CreateAnalysisRequest = z.infer<typeof CreateAnalysisRequest>;

// ---------- job lifecycle ----------

export const JobStatus = z.enum([
  "queued",
  "fetching",
  "analyzing",
  "persisting",
  "completed",
  "completed_with_limitations",
  "failed",
  "cancelled",
  "expired",
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const TERMINAL_STATUSES: readonly JobStatus[] = [
  "completed",
  "completed_with_limitations",
  "failed",
  "cancelled",
  "expired",
];
export const RESULT_STATUSES: readonly JobStatus[] = ["completed", "completed_with_limitations"];

/** Permitted transitions. Anything else is a bug and must be rejected. */
export const TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  queued: ["fetching", "failed", "cancelled", "expired"],
  fetching: ["analyzing", "failed", "cancelled", "queued"],
  analyzing: ["persisting", "failed", "cancelled", "queued"],
  persisting: ["completed", "completed_with_limitations", "failed", "queued"],
  completed: ["expired"],
  completed_with_limitations: ["expired"],
  failed: ["expired"],
  cancelled: ["expired"],
  expired: [],
};

export const canTransition = (from: JobStatus, to: JobStatus) => TRANSITIONS[from].includes(to);
export const isTerminal = (s: JobStatus) => TERMINAL_STATUSES.includes(s);

// ---------- errors ----------

export const ErrorCode = z.enum([
  "invalid_request",
  "invalid_repository",
  "unsupported_provider",
  "repository_not_found",
  "repository_not_public",
  "ref_not_found",
  "rate_limited",
  "github_unavailable",
  "imports_disabled",
  "queue_full",
  "service_unavailable",
  "not_found",
  "expired",
  "not_ready",
  "unauthorized",
  "conflict",
  "limit_exceeded",
  "analysis_timeout",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({ code: ErrorCode, message: z.string() }),
});
export type ApiError = z.infer<typeof ApiError>;

/** Errors a job can end with (subset shown on failed analyses). */
export const JobErrorCode = z.enum([
  "repository_not_found",
  "repository_not_public",
  "ref_not_found",
  "github_unavailable",
  "limit_exceeded",
  "analysis_timeout",
  "internal",
]);

// ---------- analysis resource ----------

export const AnalysisSummary = z.object({
  id: z.string().uuid(),
  repository: z.object({ owner: z.string(), repo: z.string(), url: z.string().url() }),
  ref: z.string().nullable(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  status: JobStatus,
  error: z.object({ code: JobErrorCode, message: z.string() }).nullable(),
  analyzerVersion: z.string(),
  schemaVersion: z.string(),
  stats: z
    .object({ files: z.number().int(), edges: z.number().int(), findings: z.number().int() })
    .nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type AnalysisSummary = z.infer<typeof AnalysisSummary>;

export const CreateAnalysisResponse = z.object({
  analysis: AnalysisSummary,
  /** True when an existing result for the same commit/analyzer/config was returned. */
  reused: z.boolean(),
  /** Whether this requester received a management capability (HttpOnly cookie). */
  canManage: z.boolean(),
});
export type CreateAnalysisResponse = z.infer<typeof CreateAnalysisResponse>;

export const FindingsResponse = z.object({ findings: z.array(z.unknown()) });

export const HealthResponse = z.object({
  status: z.enum(["ok", "degraded", "unavailable"]),
  checks: z.record(z.string(), z.enum(["ok", "fail"])).optional(),
});

/** Cookie carrying the per-analysis management capability. Path-scoped to the analysis. */
export const managementCookieName = (id: string) => `archmap_mgmt_${id.replace(/-/g, "")}`;

/** Default limits (spec §7.3). Starting policy, not measured capacity. */
export const DEFAULT_LIMITS = {
  maxArchiveBytes: 50 * 1024 * 1024,
  maxExtractedBytes: 200 * 1024 * 1024,
  maxFiles: 10_000,
  maxFileBytes: 2 * 1024 * 1024,
  maxArchiveEntries: 100_000,
  analysisTimeoutMs: 180_000,
  workerMemoryMb: 1024,
  workerConcurrency: 2,
  submissionsPerClientPerHour: 5,
  maxQueueDepth: 100,
  maxGraphBytes: 64 * 1024 * 1024,
  retentionHours: 24,
} as const;
