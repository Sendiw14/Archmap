"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import {
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type OnNodesChange,
} from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import type { Finding } from "@archmap/graph-schema";
import { computeHighlight, type Direction, type Focus } from "../../lib/graph/model";
import { toFlowElements, type ModuleFlowNode } from "../../lib/graph/flow";
import {
  FAST_LAYOUT_EDGES,
  layoutKey,
  toElkGraph,
  type LayoutDirection,
} from "../../lib/graph/layout-input";
import { computeLayout, type LayoutResult } from "../../lib/graph/layout";
import type { DisplayGraph } from "../../lib/workspace/aggregate";
import { svgInputFrom, toSafeSvg } from "../../lib/workspace/svg-export";
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
  // The graph is read-only; React Flow's default text tells screen-reader users edges can be deleted.
  "edge.a11yDescription.default":
    "Dependency edges are read-only. Select a module to inspect its imports.",
};

/** Above this many drawn nodes React Flow only renders what is in the viewport. */
const VIRTUALIZE_ABOVE = 250;

export interface GraphCanvasProps {
  display: DisplayGraph;
  focus: Focus | null;
  findings: Finding[];
  direction: Direction;
  layoutDirection: LayoutDirection;
  /** Leaf module ids matching the current search; null without a query. */
  matchIds: Set<string> | null;
  onSelectModule: (id: string) => void;
  onExpandGroup: (id: string) => void;
  onClear: () => void;
  /** Bump to refit the whole graph (initial layout, reset, Fit). */
  fitSeq: number;
  /** Fit these module ids into view (search choice, cycle choice). */
  focusRequest: { ids: string[]; seq: number } | null;
  /** Filled with a function that returns a sanitized SVG of the view as currently drawn. */
  exportRef?: MutableRefObject<(() => string) | null>;
  exportTitle?: string;
  /** Reports layout status so the toolbar can show it. */
  onLayoutInfo?: (
    info: { engine: string; ms: number; nodes: number; edges: number } | null,
  ) => void;
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

interface Snapshot {
  key: string;
  info: LayoutResult;
  display: DisplayGraph;
}

function Canvas({
  display,
  focus,
  findings,
  direction,
  layoutDirection,
  matchIds,
  onSelectModule,
  onExpandGroup,
  onClear,
  fitSeq,
  focusRequest,
  exportRef,
  exportTitle = "ARCHMAP dependency graph",
  onLayoutInfo,
}: GraphCanvasProps) {
  const { fitView } = useReactFlow();
  const reduced = useReducedMotion();
  const key = useMemo(() => layoutKey(display, layoutDirection), [display, layoutDirection]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    computeLayout(toElkGraph(display, layoutDirection))
      .then((info) => alive && setSnap({ key, info, display }))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Layout failed"));
    return () => {
      alive = false;
    };
    // `key` fully identifies the layout problem
  }, [key, attempt]);

  // Everything drawn comes from the snapshot the layout was computed for, so a pending
  // re-layout never mixes new nodes with old positions.
  const shown = snap?.display ?? null;
  const highlight = useMemo(
    () =>
      shown ? computeHighlight(shown, focus, findings, { direction, itemOf: shown.itemOf }) : null,
    [shown, focus, findings, direction],
  );
  const matchItems = useMemo(() => {
    if (!matchIds || !shown) return null;
    const out = new Set<string>();
    for (const id of matchIds) {
      const item = shown.itemOf.get(id);
      if (item) out.add(item);
    }
    return out;
  }, [matchIds, shown]);
  const selectedItem =
    focus?.kind === "node" && shown ? (shown.itemOf.get(focus.id) ?? null) : null;

  const { nodes, edges } = useMemo(
    () =>
      shown && snap && highlight
        ? toFlowElements(shown, snap.info, {
            highlight,
            matches: matchItems,
            selectedId: selectedItem,
          })
        : { nodes: [], edges: [] },
    [shown, snap, highlight, matchItems, selectedItem],
  );

  useEffect(() => {
    if (!exportRef) return;
    exportRef.current =
      shown && snap && highlight
        ? () =>
            toSafeSvg(
              svgInputFrom({
                title: exportTitle,
                description: `${shown.nodes.length} drawn items, ${shown.drawn.length} dependencies. Arrows point from importer to imported module.`,
                nodes: shown.nodes,
                drawn: shown.drawn,
                layout: snap.info,
                highlight,
                matches: matchItems,
              }),
            )
        : null;
    return () => {
      exportRef.current = null;
    };
  }, [exportRef, shown, snap, highlight, matchItems, exportTitle]);

  useEffect(() => {
    onLayoutInfo?.(
      snap
        ? {
            engine: snap.info.engine,
            ms: snap.info.ms,
            nodes: snap.display.nodes.length,
            edges: snap.display.drawn.length,
          }
        : null,
    );
  }, [snap, onLayoutInfo]);

  useEffect(() => {
    if (!focusRequest || !snap || focusRequest.ids.length === 0) return;
    const ids = [...new Set(focusRequest.ids.map((id) => snap.display.itemOf.get(id) ?? id))];
    const raf = requestAnimationFrame(() =>
      fitView({
        nodes: ids.map((n) => ({ id: n })),
        padding: "30%",
        maxZoom: 1.1,
        duration: reduced ? 0 : 250,
      }),
    );
    return () => cancelAnimationFrame(raf);
    // run only for a new request
  }, [focusRequest?.seq]);

  const onNodesChange = useCallback<OnNodesChange<ModuleFlowNode>>(
    (changes) => {
      // keyboard (Enter / Space) and pointer selection both arrive as select changes
      for (const c of changes.getByType("select")) {
        if (!c.selected) continue;
        const item = snap?.display.nodeById.get(c.id);
        if (item?.kind === "group") onExpandGroup(c.id);
        else onSelectModule(c.id);
      }
    },
    [onSelectModule, onExpandGroup, snap],
  );

  const pending = snap !== null && snap.key !== key;

  return (
    <div
      className="relative size-full"
      role="region"
      aria-label="Dependency graph"
      onKeyDown={(e) => e.key === "Escape" && onClear()}
    >
      {snap && (
        <ReactFlow
          // remount per layout or reset: React Flow then does its own initial fit
          key={`${snap.key}|${fitSeq}`}
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
          onlyRenderVisibleElements={snap.display.nodes.length > VIRTUALIZE_ABOVE}
          minZoom={0.05}
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
            ELK {snap.display.drawn.length > FAST_LAYOUT_EDGES ? "stress" : "layered"} layout,{" "}
            {snap.info.engine === "worker" ? "Web Worker" : "main thread"},{" "}
            {Math.round(snap.info.ms)} ms
          </Panel>
        </ReactFlow>
      )}
      {(!snap || pending) && !error && (
        <div
          className={`absolute inset-0 grid ${snap ? "pointer-events-none items-start justify-center pt-3" : "place-items-center bg-surface/80"}`}
          role="status"
        >
          <p className="rounded-lg border border-line bg-bg px-4 py-2 text-sm shadow-sm">
            {snap
              ? "Updating layout"
              : `Laying out ${display.nodes.length} ${display.groups > 0 ? "items" : "modules"}`}
            &hellip;
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
