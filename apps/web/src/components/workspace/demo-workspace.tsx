"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { ArchmapGraph } from "@archmap/graph-schema";
import { loadDemoGraph, metaFromDemo } from "../../lib/analysis-source";
import { DEFAULT_SAMPLE_ID, SAMPLES } from "../../lib/graph/samples";
import { Workspace } from "./workspace";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; graph: ArchmapGraph };

/** /demo: the full workspace on bundled analyzer output, plus the sample picker and walkthrough. */
export function DemoWorkspace() {
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE_ID);
  const [openCycle, setOpenCycle] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]!;

  useEffect(() => {
    let alive = true;
    setLoad({ status: "loading" });
    loadDemoGraph({ kind: "sample", sample })
      .then((graph) => alive && setLoad({ status: "ready", graph }))
      .catch((e: unknown) => {
        if (alive)
          setLoad({
            status: "error",
            message: `Could not load the sample: ${e instanceof Error ? e.message : "unknown error"}`,
          });
      });
    return () => {
      alive = false;
    };
  }, [sample, attempt]);

  const changeSample = useCallback((id: string, opts?: { openCycle?: boolean }) => {
    setOpenCycle(!!opts?.openCycle);
    setSampleId(id);
  }, []);

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)]">
      {load.status === "ready" ? (
        <Workspace
          key={sampleId}
          graph={load.graph}
          meta={metaFromDemo(`demo-${sample.id}`, { kind: "sample", sample }, load.graph)}
          basePath={`/analyses/demo-${sample.id}`}
          initialCycle={openCycle ? "first" : null}
          demo={{ samples: SAMPLES, sampleId, onSampleChange: changeSample }}
        />
      ) : (
        <div className="grid min-h-[60dvh] place-items-center p-6">
          {load.status === "loading" ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted">
              <Loader2
                size={18}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
              Loading {sample.label}&hellip;
            </p>
          ) : (
            <div
              role="alert"
              className="max-w-md rounded-xl border border-danger bg-danger-soft p-4 text-sm"
            >
              <p className="flex items-center gap-2 font-semibold text-danger">
                <AlertTriangle size={18} aria-hidden="true" /> This sample could not be loaded
              </p>
              <p className="mt-1">{load.message}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="am-btn am-btn-sm"
                  onClick={() => setAttempt((a) => a + 1)}
                >
                  Try again
                </button>
                {sampleId !== DEFAULT_SAMPLE_ID && (
                  <button
                    type="button"
                    className="am-btn am-btn-sm"
                    onClick={() => changeSample(DEFAULT_SAMPLE_ID)}
                  >
                    Open the default sample
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
