import type { ErrorCode, JobStatus } from "@archmap/contracts";

export interface AnalysisRecord {
  id: string;
  owner: string;
  repo: string;
  ref: string | null;
  commit: string;
  status: JobStatus;
  errorCode: string | null;
  errorMessage: string | null;
  /** sha256(hex) of the management token; never the token itself. Null when not manageable. */
  managementVerifier: string | null;
  /** HMAC of the client address; used only for quotas. */
  clientKey: string;
  cacheKey: string;
  analyzerVersion: string;
  schemaVersion: string;
  artifactKey: string | null;
  stats: { files: number; edges: number; findings: number } | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export type RecordPatch = Partial<
  Pick<AnalysisRecord, "errorCode" | "errorMessage" | "artifactKey" | "stats" | "attempts">
>;

export interface AnalysisStore {
  create(rec: AnalysisRecord): Promise<void>;
  get(id: string): Promise<AnalysisRecord | null>;
  /** Most recent non-expired record with a result for this cache key. */
  findReusable(cacheKey: string, now: Date): Promise<AnalysisRecord | null>;
  /**
   * Atomic compare-and-set: moves to `to` only if the current status is in `from`.
   * Returns the updated record, or null when the precondition failed.
   */
  transition(
    id: string,
    from: readonly JobStatus[],
    to: JobStatus,
    patch?: RecordPatch,
  ): Promise<AnalysisRecord | null>;
  delete(id: string): Promise<boolean>;
  countCreatedByClientSince(clientKey: string, since: Date): Promise<number>;
  /** Records not yet in status "expired" whose expiresAt is before `now`. */
  listExpired(now: Date, limit: number): Promise<AnalysisRecord[]>;
  /** Number of records in non-terminal states (queue depth guard). */
  countActive(): Promise<number>;
  /** Delete tombstones (status expired) whose expiresAt is before `before`. */
  purge(before: Date): Promise<number>;
  ping(): Promise<void>;
}

export interface ArtifactStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  ping(): Promise<void>;
}

export interface JobQueue {
  /** Idempotent: enqueueing the same id twice yields one job. */
  enqueue(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  ping(): Promise<void>;
}

export interface ResolvedRepository {
  owner: string;
  repo: string;
  commit: string;
  ref: string | null;
  /** Approximate repository size in KiB as reported by the provider. */
  sizeKb: number;
}

export interface SourceProvider {
  /** Confirms the repository is public and resolves an immutable commit. */
  resolve(owner: string, repo: string, ref: string | undefined): Promise<ResolvedRepository>;
  /** Downloads a .tar.gz of the commit, aborting above maxBytes. */
  download(r: ResolvedRepository, maxBytes: number, signal: AbortSignal): Promise<Buffer>;
}

export class HostedError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  constructor(code: ErrorCode, message: string, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}
