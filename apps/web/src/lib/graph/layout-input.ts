import type { ElkEdgeSection, ElkNode } from "elkjs/lib/elk-api";
import type { VisibleGraph } from "./model";

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 52;

export const ELK_OPTIONS = {
  "elk.algorithm": "layered",
  // Importers on the left, imported modules on the right.
  "elk.direction": "RIGHT",
  "elk.layered.spacing.nodeNodeBetweenLayers": "72",
  "elk.spacing.nodeNode": "22",
  "elk.spacing.componentComponent": "48",
  "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
  // ELK routes every edge (including cycle-closing back edges) so nothing crosses a node.
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.spacing.edgeEdge": "10",
  "elk.layered.spacing.edgeNodeBetweenLayers": "18",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "10",
} as const;

export interface Point {
  x: number;
  y: number;
}
export type Positions = Map<string, Point>;
/** Polyline per drawn-edge id, from ELK's own edge routing. */
export type Routes = Map<string, Point[]>;
export interface LayoutData {
  positions: Positions;
  routes: Routes;
}

export function toElkGraph(vg: Pick<VisibleGraph, "nodes" | "drawn">): ElkNode {
  return {
    id: "root",
    layoutOptions: { ...ELK_OPTIONS },
    children: vg.nodes.map((n) => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: vg.drawn.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
}

export function toPositions(laid: ElkNode): Positions {
  const out: Positions = new Map();
  for (const c of laid.children ?? []) out.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
  return out;
}

export function toRoutes(laid: ElkNode): Routes {
  const out: Routes = new Map();
  for (const e of laid.edges ?? []) {
    const sec = (e as { sections?: ElkEdgeSection[] }).sections?.[0];
    if (!sec) continue;
    out.set(e.id, [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint]);
  }
  return out;
}

export function toLayoutData(laid: ElkNode): LayoutData {
  return { positions: toPositions(laid), routes: toRoutes(laid) };
}

/** Identity of a layout problem: re-layout only when this changes. */
export function layoutKey(vg: Pick<VisibleGraph, "nodes" | "drawn">): string {
  return `${vg.nodes.map((n) => n.id).join("\n")}\n--\n${vg.drawn.map((e) => e.id).join("\n")}`;
}
