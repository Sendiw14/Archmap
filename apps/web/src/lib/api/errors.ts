import { DEFAULT_LIMITS, type ErrorCode } from "@archmap/contracts";
import { formatCount, formatDuration, formatHours, formatMiB } from "../format";

export type RecoveryAction = "retry" | "edit" | "wait" | "cli" | "none";

export interface ErrorCopy {
  title: string;
  message: string;
  action: RecoveryAction;
  actionLabel: string;
}

const L = DEFAULT_LIMITS;

/**
 * One human message and one recovery action for every API ErrorCode.
 * `Record<ErrorCode, ...>` makes a new code in the contract a compile error here.
 */
export const ERROR_COPY: Record<ErrorCode, ErrorCopy> = {
  invalid_request: {
    title: "That request was not valid",
    message: "Check the repository and branch fields and try again.",
    action: "edit",
    actionLabel: "Edit the request",
  },
  invalid_repository: {
    title: "That is not a GitHub repository",
    message: "Use owner/repo or a github.com URL, for example vercel/next.js.",
    action: "edit",
    actionLabel: "Edit the repository",
  },
  unsupported_provider: {
    title: "Only GitHub is supported",
    message:
      "Hosted analysis accepts public GitHub repositories only. For GitLab, Bitbucket or private code, run the CLI on a local checkout.",
    action: "cli",
    actionLabel: "Use the CLI instead",
  },
  repository_not_found: {
    title: "Repository not found",
    message:
      "GitHub has no public repository with that name. Check the spelling of owner and repo.",
    action: "edit",
    actionLabel: "Edit the repository",
  },
  repository_not_public: {
    title: "Repository is not public",
    message:
      "Hosted analysis can only read public repositories. Your private code never has to leave your machine: run the CLI locally.",
    action: "cli",
    actionLabel: "Use the CLI instead",
  },
  ref_not_found: {
    title: "Branch, tag or commit not found",
    message: "That ref does not exist in the repository. Leave it empty to use the default branch.",
    action: "edit",
    actionLabel: "Edit the ref",
  },
  rate_limited: {
    title: "Too many analyses from this network",
    message: `Anonymous use is limited to ${L.submissionsPerClientPerHour} analyses per hour. Wait a while, or run the CLI locally with no limit.`,
    action: "wait",
    actionLabel: "Try again later",
  },
  github_unavailable: {
    title: "GitHub did not respond",
    message:
      "GitHub is rate limiting or unavailable right now. This usually clears within a few minutes.",
    action: "retry",
    actionLabel: "Try again",
  },
  imports_disabled: {
    title: "Hosted import is paused",
    message:
      "The analysis workers are unavailable or imports were switched off to protect the service. Nothing is wrong with your repository. The CLI works offline.",
    action: "cli",
    actionLabel: "Use the CLI instead",
  },
  queue_full: {
    title: "The analysis queue is full",
    message: `${formatCount(L.maxQueueDepth)} analyses are already waiting. Try again in a few minutes.`,
    action: "retry",
    actionLabel: "Try again",
  },
  not_found: {
    title: "Analysis not found",
    message: "No analysis has this ID. The link may be mistyped, or the analysis was deleted.",
    action: "none",
    actionLabel: "Import a repository",
  },
  expired: {
    title: "This analysis has expired",
    message: `Results are kept for ${formatHours(L.retentionHours)}, then deleted. Run the analysis again to get a fresh result.`,
    action: "edit",
    actionLabel: "Analyze again",
  },
  not_ready: {
    title: "The result is not ready yet",
    message: "The analysis is still running. This page keeps checking.",
    action: "wait",
    actionLabel: "Keep waiting",
  },
  unauthorized: {
    title: "You cannot manage this analysis",
    message:
      "Only the browser that created an analysis can cancel or delete it, and that permission lapses when the session cookie does. Viewing it does not need any permission.",
    action: "none",
    actionLabel: "OK",
  },
  conflict: {
    title: "The analysis changed state",
    message:
      "It finished, was cancelled or expired while you were acting. Reload to see the current state.",
    action: "retry",
    actionLabel: "Reload",
  },
  limit_exceeded: {
    title: "The repository is over the hosted limits",
    message: `Hosted analysis stops at ${formatMiB(L.maxArchiveBytes)} compressed, ${formatMiB(L.maxExtractedBytes)} extracted, ${formatCount(L.maxFiles)} source files or ${formatMiB(L.maxFileBytes)} per file. The CLI has no such cap on your own machine.`,
    action: "cli",
    actionLabel: "Use the CLI instead",
  },
  analysis_timeout: {
    title: "The analysis took too long",
    message: `Analyses are stopped after ${formatDuration(L.analysisTimeoutMs)}. Try a smaller repository, or run the CLI locally.`,
    action: "cli",
    actionLabel: "Use the CLI instead",
  },
  internal: {
    title: "Something went wrong on our side",
    message: "The service hit an unexpected error. Trying again often works.",
    action: "retry",
    actionLabel: "Try again",
  },
};

const STATUS_CODE: Record<number, ErrorCode> = {
  400: "invalid_request",
  401: "unauthorized",
  404: "not_found",
  409: "conflict",
  410: "expired",
  429: "rate_limited",
  503: "imports_disabled",
};

export type ApiErrorKind = "api" | "network" | "invalid_response" | "aborted";

/** Every failure the client can produce. `code` is set whenever the server (or HTTP status) identifies one. */
export class ApiClientError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: ErrorCode | null;
  readonly retryAfterSeconds: number | null;

  constructor(init: {
    kind: ApiErrorKind;
    message: string;
    status?: number | null;
    code?: ErrorCode | null;
    retryAfterSeconds?: number | null;
  }) {
    super(init.message);
    this.name = "ApiClientError";
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.code = init.code ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }

  /** Transient: worth retrying automatically (network, server, rate limit). */
  get transient(): boolean {
    if (this.kind === "network") return true;
    if (this.kind !== "api") return false;
    return (
      this.code === "rate_limited" ||
      this.code === "github_unavailable" ||
      this.code === "internal" ||
      (this.status !== null && this.status >= 500)
    );
  }
}

export function codeFromStatus(status: number): ErrorCode {
  return STATUS_CODE[status] ?? (status >= 500 ? "internal" : "invalid_request");
}

const NETWORK_COPY: ErrorCopy = {
  title: "Cannot reach the ARCHMAP service",
  message:
    "The hosted analysis service did not answer. Check your connection and try again. The demo and the CLI do not need it.",
  action: "retry",
  actionLabel: "Try again",
};

const INVALID_COPY: ErrorCopy = {
  title: "The service sent an unexpected response",
  message: "The response did not match the published API contract, so it was not used.",
  action: "retry",
  actionLabel: "Try again",
};

/** Copy for any thrown value. Unknown errors map to the generic "internal" copy. */
export function copyForError(err: unknown): ErrorCopy {
  if (err instanceof ApiClientError) {
    if (err.kind === "network") return NETWORK_COPY;
    if (err.kind === "invalid_response") return INVALID_COPY;
    if (err.code) {
      const base = ERROR_COPY[err.code];
      if (err.code === "rate_limited" && err.retryAfterSeconds) {
        const mins = Math.max(1, Math.ceil(err.retryAfterSeconds / 60));
        return {
          ...base,
          message: `${base.message} The service asks you to wait about ${mins} min.`,
        };
      }
      return base;
    }
  }
  return ERROR_COPY.internal;
}
