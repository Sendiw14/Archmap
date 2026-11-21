import { RESULT_STATUSES, type AnalysisSummary, type JobStatus } from "@archmap/contracts";
import { ApiClientError } from "./errors";

/**
 * Polling state machine for GET /v1/analyses/:id. Pure: the React hook only feeds events in
 * and schedules timers from `nextDelayMs`, so every transition here is unit-tested.
 */

export const MAX_FAILURES = 5;

export type PollState =
  | { phase: "loading"; failures: number; polls: number }
  | { phase: "active"; summary: AnalysisSummary; failures: number; polls: number }
  | { phase: "result"; summary: AnalysisSummary }
  | { phase: "terminal"; summary: AnalysisSummary }
  | { phase: "gone"; reason: "not_found" | "expired" }
  | { phase: "stalled"; error: ApiClientError; last: AnalysisSummary | null };

export type PollEvent =
  | { type: "summary"; summary: AnalysisSummary }
  | { type: "error"; error: ApiClientError }
  | { type: "retry" };

export const INITIAL_POLL: PollState = { phase: "loading", failures: 0, polls: 0 };

export const classifyStatus = (s: JobStatus): "result" | "terminal" | "active" =>
  RESULT_STATUSES.includes(s)
    ? "result"
    : s === "failed" || s === "cancelled" || s === "expired"
      ? "terminal"
      : "active";

const lastSummary = (s: PollState): AnalysisSummary | null =>
  s.phase === "active" || s.phase === "result" || s.phase === "terminal"
    ? s.summary
    : s.phase === "stalled"
      ? s.last
      : null;

export function pollReducer(state: PollState, event: PollEvent): PollState {
  if (event.type === "retry") return { phase: "loading", failures: 0, polls: 0 };
  if (state.phase === "gone") return state;

  if (event.type === "summary") {
    const { summary } = event;
    const kind = classifyStatus(summary.status);
    if (kind === "result") return { phase: "result", summary };
    if (kind === "terminal") return { phase: "terminal", summary };
    const polls = state.phase === "active" || state.phase === "loading" ? state.polls + 1 : 1;
    return { phase: "active", summary, failures: 0, polls };
  }

  const { error } = event;
  if (error.kind === "aborted") return state;
  if (error.code === "not_found") return { phase: "gone", reason: "not_found" };
  if (error.code === "expired") return { phase: "gone", reason: "expired" };
  const last = lastSummary(state);
  const failures =
    state.phase === "loading" || state.phase === "active" ? state.failures + 1 : MAX_FAILURES;
  if (!error.transient || failures >= MAX_FAILURES) return { phase: "stalled", error, last };
  const polls = state.phase === "loading" || state.phase === "active" ? state.polls + 1 : 1;
  return last && state.phase === "active"
    ? { phase: "active", summary: last, failures, polls }
    : { phase: "loading", failures, polls };
}

/** Delay before the next request, or null when polling must stop. The first request is immediate. */
export function nextDelayMs(state: PollState): number | null {
  if (state.phase !== "loading" && state.phase !== "active") return null;
  if (state.failures > 0) return Math.min(15_000, 2_000 * 2 ** (state.failures - 1));
  if (state.phase === "loading" && state.polls === 0) return 0;
  return Math.min(5_000, 1_000 + state.polls * 500);
}

/** Phases worth showing while a job runs. No percentages exist, so none are invented. */
export const PHASES = ["queued", "fetching", "analyzing", "persisting"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, { label: string; detail: string }> = {
  queued: { label: "Queued", detail: "Waiting for a free analysis worker." },
  fetching: { label: "Fetching", detail: "Downloading the repository archive from GitHub." },
  analyzing: { label: "Analyzing", detail: "Parsing source files and resolving imports." },
  persisting: { label: "Saving", detail: "Storing the normalized graph." },
};

export const isPhase = (s: JobStatus): s is Phase => (PHASES as readonly string[]).includes(s);
