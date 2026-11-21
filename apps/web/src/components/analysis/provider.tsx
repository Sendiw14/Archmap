"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { AnalysisSummary } from "@archmap/contracts";
import type { ArchmapGraph } from "@archmap/graph-schema";
import { api } from "../../lib/api/client";
import { ApiClientError } from "../../lib/api/errors";
import { INITIAL_POLL, nextDelayMs, pollReducer } from "../../lib/api/poll";
import { canManage as storedCanManage, forgetManage } from "../../lib/api/session";
import {
  demoSourceFor,
  loadDemoGraph,
  metaFromDemo,
  metaFromSummary,
  type AnalysisMeta,
} from "../../lib/analysis-source";
import { useToast } from "../ui/toast";

export type AnalysisView =
  | { state: "loading"; message: string }
  | { state: "pending"; summary: AnalysisSummary; stale: boolean }
  | { state: "ready"; graph: ArchmapGraph; meta: AnalysisMeta }
  | { state: "failed"; summary: AnalysisSummary }
  | { state: "cancelled"; summary: AnalysisSummary }
  | { state: "expired"; summary: AnalysisSummary | null }
  | { state: "not_found" }
  | { state: "error"; error: unknown };

interface Ctx {
  id: string;
  view: AnalysisView;
  retry: () => void;
  /** Cancel/Delete are shown only when this is true; the server enforces it regardless. */
  canManage: boolean;
  cancel: () => Promise<void>;
  remove: () => Promise<void>;
  busy: "cancel" | "delete" | null;
}

const AnalysisContext = createContext<Ctx | null>(null);

export function useAnalysis(): Ctx {
  const c = useContext(AnalysisContext);
  if (!c) throw new Error("useAnalysis must be used inside <AnalysisProvider>");
  return c;
}

/** For pages rendered only once the graph is ready. */
export function useReadyAnalysis(): { id: string; graph: ArchmapGraph; meta: AnalysisMeta } {
  const { id, view } = useAnalysis();
  if (view.state !== "ready") throw new Error("useReadyAnalysis outside the ready state");
  return { id, graph: view.graph, meta: view.meta };
}

type GraphState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; graph: ArchmapGraph }
  | { status: "error"; error: unknown };

const GRAPH_NOT_READY_RETRIES = 20;

export function AnalysisProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const demo = useMemo(() => demoSourceFor(id), [id]);
  const isDemo = id.startsWith("demo-");
  const [poll, dispatch] = useReducer(pollReducer, INITIAL_POLL);
  const [graphState, setGraphState] = useState<GraphState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState<Ctx["busy"]>(null);
  const router = useRouter();
  const notify = useToast();

  useEffect(() => setManage(!isDemo && storedCanManage(id)), [id, isDemo]);

  // ---- demo: no API at all
  useEffect(() => {
    if (!isDemo) return;
    let alive = true;
    setGraphState({ status: "loading" });
    if (!demo) {
      setGraphState({
        status: "error",
        error: new ApiClientError({
          kind: "api",
          code: "not_found",
          status: 404,
          message: "Unknown demo analysis",
        }),
      });
      return;
    }
    loadDemoGraph(demo)
      .then((graph) => alive && setGraphState({ status: "ready", graph }))
      .catch((error: unknown) => alive && setGraphState({ status: "error", error }));
    return () => {
      alive = false;
    };
  }, [isDemo, demo, attempt]);

  // ---- hosted: poll the summary while it is non-terminal
  useEffect(() => {
    if (isDemo) return;
    const delay = nextDelayMs(poll);
    if (delay === null) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api
        .getAnalysis(id, { signal: ctrl.signal })
        .then((summary) => dispatch({ type: "summary", summary }))
        .catch((error: unknown) => {
          if (error instanceof ApiClientError) dispatch({ type: "error", error });
          else
            dispatch({
              type: "error",
              error: new ApiClientError({ kind: "network", message: "unexpected" }),
            });
        });
    }, delay);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [id, isDemo, poll]);

  // ---- hosted: fetch the graph once a result exists. 409 not_ready keeps polling.
  const resultSummary = poll.phase === "result" ? poll.summary : null;
  useEffect(() => {
    if (isDemo || !resultSummary) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setGraphState({ status: "loading" });
    const run = (triesLeft: number) =>
      api
        .getGraph(id, { signal: ctrl.signal })
        .then((graph) => setGraphState({ status: "ready", graph }))
        .catch((error: unknown) => {
          if (ctrl.signal.aborted) return;
          if (error instanceof ApiClientError && error.code === "not_ready" && triesLeft > 0) {
            timer = setTimeout(() => run(triesLeft - 1), 1500);
            return;
          }
          if (
            error instanceof ApiClientError &&
            (error.code === "expired" || error.code === "not_found")
          ) {
            dispatch({ type: "error", error });
            return;
          }
          setGraphState({ status: "error", error });
        });
    run(GRAPH_NOT_READY_RETRIES);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [id, isDemo, resultSummary?.status, resultSummary?.updatedAt, attempt]);

  const retry = useCallback(() => {
    dispatch({ type: "retry" });
    setGraphState({ status: "idle" });
    setAttempt((a) => a + 1);
  }, []);

  const handleManageError = useCallback(
    (error: unknown, what: string) => {
      if (error instanceof ApiClientError && error.code === "unauthorized") {
        forgetManage(id);
        setManage(false);
        notify(
          `You cannot ${what} this analysis from this browser. The management session has ended.`,
          "error",
        );
      } else if (error instanceof ApiClientError && error.code === "conflict") {
        notify(
          "The analysis changed state before the request arrived. Showing the current state.",
          "error",
        );
        retry();
      } else notify(`Could not ${what} the analysis. Try again.`, "error");
    },
    [id, notify, retry],
  );

  const cancel = useCallback(async () => {
    setBusy("cancel");
    try {
      await api.cancelAnalysis(id);
      notify("Cancellation requested.");
      dispatch({ type: "retry" });
    } catch (e) {
      handleManageError(e, "cancel");
    } finally {
      setBusy(null);
    }
  }, [id, notify, handleManageError]);

  const remove = useCallback(async () => {
    setBusy("delete");
    try {
      await api.deleteAnalysis(id);
      forgetManage(id);
      notify("Analysis deleted.");
      router.push("/import");
    } catch (e) {
      handleManageError(e, "delete");
    } finally {
      setBusy(null);
    }
  }, [id, router, notify, handleManageError]);

  const view = useMemo<AnalysisView>(() => {
    if (isDemo) {
      if (graphState.status === "ready" && demo)
        return {
          state: "ready",
          graph: graphState.graph,
          meta: metaFromDemo(id, demo, graphState.graph),
        };
      if (graphState.status === "error") {
        const e = graphState.error;
        return e instanceof ApiClientError && e.code === "not_found"
          ? { state: "not_found" }
          : { state: "error", error: e };
      }
      return { state: "loading", message: "Loading the bundled demo data" };
    }
    switch (poll.phase) {
      case "gone":
        return poll.reason === "not_found"
          ? { state: "not_found" }
          : { state: "expired", summary: null };
      case "stalled":
        return { state: "error", error: poll.error };
      case "terminal":
        return poll.summary.status === "failed"
          ? { state: "failed", summary: poll.summary }
          : poll.summary.status === "cancelled"
            ? { state: "cancelled", summary: poll.summary }
            : { state: "expired", summary: poll.summary };
      case "active":
        return { state: "pending", summary: poll.summary, stale: poll.failures > 0 };
      case "result":
        if (graphState.status === "ready")
          return {
            state: "ready",
            graph: graphState.graph,
            meta: metaFromSummary(poll.summary, graphState.graph),
          };
        if (graphState.status === "error") return { state: "error", error: graphState.error };
        return { state: "loading", message: "Loading the dependency graph" };
      default:
        return { state: "loading", message: "Checking the analysis" };
    }
  }, [isDemo, demo, id, poll, graphState]);

  const value = useMemo<Ctx>(
    () => ({ id, view, retry, canManage: manage, cancel, remove, busy }),
    [id, view, retry, manage, cancel, remove, busy],
  );
  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
