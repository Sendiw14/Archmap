"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type OnNodesChange,
} from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import type { Highlight, VisibleGraph } from "../../lib/graph/model";
import { toFlowElements, type ModuleFlowNode } from "../../lib/graph/flow";
import { layoutKey, toElkGraph } from "../../lib/graph/layout-input";
import { computeLayout, type LayoutResult } from "../../lib/graph/layout";
import { useReducedMotion } from "../../hooks/use-media-query";
import { ModuleNode } from "./module-node";
import { RouteEdge } from "./route-edge";

const nodeTypes = { module: ModuleNode };
const edgeTypes = { route: RouteEdge };
const ARIA = {
  "node.a11yDescription.default":
    "Press Enter or Space to select this module and show its details.",
  "node.a11yDescription.keyboardDisabled":
    "Press Enter or Space to select this module and show its details.",
};

export interface GraphCanvasProps {
  vg: VisibleGraph;
  highlight: Highlight;
  matches: Set<string> | null;
  selectedId: string | null;
  onSelectNode: (id: string) => void;
  onClear: () => void;
  /** Bump to refit the whole graph (initial layout, reset). */
  fitSeq: number;
  /** Fit these node ids into view (search choice, cycle choice). */
  focusRequest: { ids: string[]; seq: number } | null;
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({
  vg,
  highlight,
  matches,
  selectedId,
  onSelectNode,
  onClear,
  fitSeq,
  focusRequest,
}: GraphCanvasProps) {
  const { fitView } = useReactFlow();
  const reduced = useReducedMotion();
  const key = useMemo(() => layoutKey(vg), [vg]);
  const [layout, setLayout] = useState<{
    key: string;
    info: LayoutResult;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    computeLayout(toElkGraph(vg))
      .then((info) => alive && setLayout({ key, info }))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Layout failed"));
    return () => {
      alive = false;
    };
    // `key` fully identifies the layout problem
  }, [key, attempt]);

  const { nodes, edges } = useMemo(
    () =>
      toFlowElements(vg, layout?.info ?? { positions: new Map(), routes: new Map() }, {
        highlight,
        matches,
        selectedId,
      }),
    [vg, layout, highlight, matches, selectedId],
  );

  useEffect(() => {
    if (!focusRequest || !layout || focusRequest.ids.length === 0) return;
    const id = requestAnimationFrame(() =>
      fitView({
        nodes: focusRequest.ids.map((n) => ({ id: n })),
        padding: "30%",
        maxZoom: 1.1,
        duration: reduced ? 0 : 250,
      }),
    );
    return () => cancelAnimationFrame(id);
    // run only for a new request
  }, [focusRequest?.seq]);

  const onNodesChange = useCallback<OnNodesChange<ModuleFlowNode>>(
    (changes) => {
      // keyboard (Enter / Space) and pointer selection both arrive as select changes
      for (const c of changes.getByType("select")) if (c.selected) onSelectNode(c.id);
    },
    [onSelectNode],
  );

  return (
    <div
      className="relative size-full"
      role="region"
      aria-label="Dependency graph"
      onKeyDown={(e) => e.key === "Escape" && onClear()}
    >
      {layout && (
        <ReactFlow
          // remount per layout or reset: React Flow then does its own initial fit
          key={`${layout.key}|${fitSeq}`}
          fitView
          fitViewOptions={{ padding: "12%", maxZoom: 1.1 }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onPaneClick={onClear}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          elementsSelectable
          minZoom={0.1}
          maxZoom={2}
          ariaLabelConfig={ARIA}
          deleteKeyCode={null}
        >
          <Controls
            showInteractive={false}
            position="bottom-left"
            aria-label="Graph view controls"
          />
          <Panel
            position="bottom-right"
            className="!m-2 rounded-md bg-bg/90 px-2 py-1 text-[11px] text-muted"
          >
            ELK layered layout, {layout.info.engine === "worker" ? "Web Worker" : "main thread"},{" "}
            {Math.round(layout.info.ms)} ms
          </Panel>
        </ReactFlow>
      )}
      {!layout && !error && (
        <div className="absolute inset-0 grid place-items-center bg-surface/80" role="status">
          <p className="rounded-lg border border-line bg-bg px-4 py-2 text-sm">
            Laying out {vg.nodes.length} modules&hellip;
          </p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-surface p-6" role="alert">
          <div className="max-w-sm rounded-xl border border-danger bg-danger-soft p-4 text-sm text-ink">
            <p className="flex items-center gap-2 font-semibold text-danger">
              <AlertTriangle size={18} aria-hidden="true" /> The graph layout failed
            </p>
            <p className="mt-1">{error}. The list view shows the same data.</p>
            <button
              type="button"
              className="am-btn am-btn-sm mt-3"
              onClick={() => setAttempt((a) => a + 1)}
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
