import type { ElkEdgeSection, ElkNode } from "elkjs/lib/elk-api";
import type { DrawnEdge } from "./model";

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

export type LayoutDirection = "RIGHT" | "DOWN";

/** Orthogonal routing and full crossing minimisation get slow on big edge sets; trade polish for speed. */
export const FAST_LAYOUT_EDGES = 150;

interface LayoutInput {
  nodes: readonly { id: string }[];
  drawn: readonly DrawnEdge[];
}

export interface LayoutSize {
  width: number;
  height: number;
  /** Space between layers; tighter for small previews. */
  layerSpacing?: number;
}

export function toElkGraph(
  vg: LayoutInput,
  direction: LayoutDirection = "RIGHT",
  size: LayoutSize = { width: NODE_WIDTH, height: NODE_HEIGHT },
): ElkNode {
  const fast = vg.drawn.length > FAST_LAYOUT_EDGES;
  return {
    id: "root",
    layoutOptions: {
      ...ELK_OPTIONS,
      "elk.direction": direction,
      ...(size.layerSpacing
        ? { "elk.layered.spacing.nodeNodeBetweenLayers": String(size.layerSpacing) }
        : {}),
      ...(fast
        ? {
            // Dense overviews (many group-to-group edges) turn into hundreds of layers with a layered
            // layout. A stress layout keeps them compact; overlaps and straight routes are fixed up in
            // toLayoutData. Arrow direction still shows importer -> imported.
            "elk.algorithm": "stress",
            "elk.stress.desiredEdgeLength": "420",
            "elk.spacing.nodeNode": "60",
          }
        : {}),
    },
    children: vg.nodes.map((n) => ({ id: n.id, width: size.width, height: size.height })),
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

/** Push overlapping boxes apart along the axis of least overlap. Deterministic; O(n^2) per pass, n <= a few hundred. */
export function spreadOverlaps(pos: Positions, w: number, h: number, gap = 28, passes = 80): void {
  const ids = [...pos.keys()];
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i]!)!;
        const b = pos.get(ids[j]!)!;
        const ox = w + gap - Math.abs(a.x - b.x);
        const oy = h + gap - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox < oy) {
          const d = (ox / 2) * (a.x <= b.x ? 1 : -1);
          a.x -= d;
          b.x += d;
        } else {
          const d = (oy / 2) * (a.y <= b.y ? 1 : -1);
          a.y -= d;
          b.y += d;
        }
      }
    }
    if (!moved) break;
  }
  // keep coordinates non-negative
  let minX = Infinity;
  let minY = Infinity;
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
  }
  for (const p of pos.values()) {
    p.x -= minX;
    p.y -= minY;
  }
}

/** Straight route between two boxes: centre to centre, clipped to each box's border. */
export function straightRoute(a: Point, b: Point, w: number, h: number): Point[] {
  const ca = { x: a.x + w / 2, y: a.y + h / 2 };
  const cb = { x: b.x + w / 2, y: b.y + h / 2 };
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const clip = (c: Point, sign: 1 | -1): Point => {
    const t = Math.min(
      dx === 0 ? Infinity : w / 2 / Math.abs(dx),
      dy === 0 ? Infinity : h / 2 / Math.abs(dy),
    );
    return { x: c.x + sign * dx * t, y: c.y + sign * dy * t };
  };
  return [clip(ca, 1), clip(cb, -1)];
}

export function toLayoutData(
  laid: ElkNode,
  size = { width: NODE_WIDTH, height: NODE_HEIGHT },
): LayoutData {
  const positions = toPositions(laid);
  if (laid.layoutOptions?.["elk.algorithm"] !== "stress")
    return { positions, routes: toRoutes(laid) };
  spreadOverlaps(positions, size.width, size.height);
  const routes: Routes = new Map();
  for (const e of laid.edges ?? []) {
    const a = positions.get(e.sources?.[0] ?? "");
    const b = positions.get(e.targets?.[0] ?? "");
    if (a && b) routes.set(e.id, straightRoute(a, b, size.width, size.height));
  }
  return { positions, routes };
}

/** Identity of a layout problem: re-layout only when this changes. */
export function layoutKey(vg: LayoutInput, direction: LayoutDirection = "RIGHT"): string {
  return `${direction}\n${vg.nodes.map((n) => n.id).join("\n")}\n--\n${vg.drawn.map((e) => e.id).join("\n")}`;
}
