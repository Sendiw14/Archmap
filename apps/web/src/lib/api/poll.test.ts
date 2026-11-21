import { describe, expect, it } from "vitest";
import type { AnalysisSummary, JobStatus } from "@archmap/contracts";
import { ApiClientError } from "./errors";
import {
  INITIAL_POLL,
  MAX_FAILURES,
  classifyStatus,
  isPhase,
  nextDelayMs,
  pollReducer,
  type PollState,
} from "./poll";

const sum = (status: JobStatus): AnalysisSummary => ({
  id: "3f2b8d3e-7f0a-4a52-9c1f-0e5f2f0d6a11",
  repository: { owner: "o", repo: "r", url: "https://github.com/o/r" },
  ref: null,
  commit: "a".repeat(40),
  status,
  error: null,
  analyzerVersion: "0.1.0",
  schemaVersion: "1.0.0",
  stats: null,
  createdAt: "2026-11-21T10:00:00.000Z",
  updatedAt: "2026-11-21T10:00:00.000Z",
  expiresAt: "2026-11-22T10:00:00.000Z",
});
const api = (code: ApiClientError["code"], status: number) =>
  new ApiClientError({ kind: "api", code, status, message: "x" });
const network = new ApiClientError({ kind: "network", message: "x" });

describe("polling state machine", () => {
  it("starts loading and fetches immediately", () => {
    expect(INITIAL_POLL.phase).toBe("loading");
    expect(nextDelayMs(INITIAL_POLL)).toBe(0);
  });

  it("keeps polling through every non-terminal status, with a bounded, growing delay", () => {
    let s: PollState = INITIAL_POLL;
    const delays: number[] = [];
    for (const status of [
      "queued",
      "queued",
      "fetching",
      "analyzing",
      "analyzing",
      "persisting",
    ] as const) {
      s = pollReducer(s, { type: "summary", summary: sum(status) });
      expect(s.phase).toBe("active");
      delays.push(nextDelayMs(s)!);
    }
    expect(delays[0]).toBeGreaterThanOrEqual(1000);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
    expect(Math.max(...delays)).toBeLessThanOrEqual(5000);
    for (let i = 0; i < 30; i++) s = pollReducer(s, { type: "summary", summary: sum("analyzing") });
    expect(nextDelayMs(s)).toBe(5000);
  });

  it("stops on result statuses", () => {
    for (const status of ["completed", "completed_with_limitations"] as const) {
      const s = pollReducer(INITIAL_POLL, { type: "summary", summary: sum(status) });
      expect(s.phase).toBe("result");
      expect(nextDelayMs(s)).toBeNull();
    }
  });

  it("stops on failed, cancelled and expired", () => {
    for (const status of ["failed", "cancelled", "expired"] as const) {
      const s = pollReducer(INITIAL_POLL, { type: "summary", summary: sum(status) });
      expect(s.phase).toBe("terminal");
      expect(nextDelayMs(s)).toBeNull();
    }
  });

  it("classifies every JobStatus", () => {
    expect(classifyStatus("queued")).toBe("active");
    expect(classifyStatus("persisting")).toBe("active");
    expect(classifyStatus("completed")).toBe("result");
    expect(classifyStatus("failed")).toBe("terminal");
    expect(isPhase("queued")).toBe(true);
    expect(isPhase("completed")).toBe(false);
  });

  it("treats 404 and 410 as gone, with no further polling", () => {
    const nf = pollReducer(INITIAL_POLL, { type: "error", error: api("not_found", 404) });
    expect(nf).toEqual({ phase: "gone", reason: "not_found" });
    expect(nextDelayMs(nf)).toBeNull();
    const ex = pollReducer(INITIAL_POLL, { type: "error", error: api("expired", 410) });
    expect(ex).toEqual({ phase: "gone", reason: "expired" });
  });

  it("retries transient errors with exponential backoff, keeping the last summary visible", () => {
    let s = pollReducer(INITIAL_POLL, { type: "summary", summary: sum("analyzing") });
    const delays: number[] = [];
    for (let i = 0; i < MAX_FAILURES - 1; i++) {
      s = pollReducer(s, { type: "error", error: network });
      expect(s.phase).toBe("active");
      if (s.phase === "active") expect(s.summary.status).toBe("analyzing");
      delays.push(nextDelayMs(s)!);
    }
    expect(delays).toEqual([2000, 4000, 8000, 15000]);
  });

  it("stalls after too many consecutive failures and recovers on retry", () => {
    let s: PollState = INITIAL_POLL;
    for (let i = 0; i < MAX_FAILURES; i++) s = pollReducer(s, { type: "error", error: network });
    expect(s.phase).toBe("stalled");
    expect(nextDelayMs(s)).toBeNull();
    expect(pollReducer(s, { type: "retry" })).toEqual(INITIAL_POLL);
  });

  it("a success resets the failure count", () => {
    let s: PollState = pollReducer(INITIAL_POLL, { type: "summary", summary: sum("queued") });
    s = pollReducer(s, { type: "error", error: network });
    s = pollReducer(s, { type: "summary", summary: sum("fetching") });
    expect(s).toMatchObject({ phase: "active", failures: 0 });
  });

  it("stalls immediately on a non-transient error and ignores aborts", () => {
    const s = pollReducer(INITIAL_POLL, { type: "error", error: api("invalid_request", 400) });
    expect(s.phase).toBe("stalled");
    const abort = new ApiClientError({ kind: "aborted", message: "x" });
    expect(pollReducer(INITIAL_POLL, { type: "error", error: abort })).toBe(INITIAL_POLL);
  });

  it("never leaves the gone state", () => {
    const gone = pollReducer(INITIAL_POLL, { type: "error", error: api("not_found", 404) });
    expect(pollReducer(gone, { type: "summary", summary: sum("queued") })).toBe(gone);
  });
});
