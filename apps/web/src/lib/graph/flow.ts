import type { Edge, MarkerType, Node } from "@xyflow/react";
import type { DisplayNode } from "../workspace/aggregate";
import type { DrawnEdge, Highlight, NodeRole } from "./model";
import { NODE_HEIGHT, NODE_WIDTH, type LayoutData } from "./layout-input";

/** Graph -> React Flow elements. Pure: all styling decisions are data, rendered in CSS. */

export interface ModuleNodeData extends Record<string, unknown> {
  node: DisplayNode;
  role: NodeRole | null;
  match: boolean;
  dim: boolean;
  fanIn: number;
  fanOut: number;
}
export type ModuleFlowNode = Node<ModuleNodeData, "module">;

export interface FlowOptions {
  highlight: Highlight;
  /** Node ids matching the current search; null when there is no query. */
  matches: Set<string> | null;
  selectedId: string | null;
}

const KIND_LABEL = {
  file: "file",
  external: "external package",
  builtin: "Node.js built-in",
  group: "group",
};
const ROLE_LABEL: Record<NodeRole, string> = {
  selected: "selected",
  dependency: "imported by the selection",
  dependent: "imports the selection",
  both: "imports and is imported by the selection",
  member: "member of the selected cycle",
};

const modules = (n: number) => `${n} ${n === 1 ? "module" : "modules"}`;

export function nodeAriaLabel(d: ModuleNodeData, selected: boolean): string {
  if (d.node.kind === "group") {
    const n = d.node.memberCount ?? 0;
    return [
      `${d.node.displayName}, ${d.node.groupKind === "package" ? "package" : "folder"} group of ${modules(n)}`,
      `imports ${modules(d.fanOut)}`,
      `imported by ${modules(d.fanIn)}`,
      ...(d.role ? [ROLE_LABEL[d.role]] : []),
      ...(d.match ? ["contains a search match"] : []),
      "press Enter to expand",
    ].join(", ");
  }
  const parts = [
    d.node.displayName,
    KIND_LABEL[d.node.kind],
    ...(d.node.package ? [`package ${d.node.package}`] : []),
    `imports ${modules(d.fanOut)}`,
    `imported by ${modules(d.fanIn)}`,
    ...(d.role && !selected ? [ROLE_LABEL[d.role]] : []),
    ...(selected ? ["selected"] : []),
    ...(d.match ? ["search match"] : []),
  ];
  return parts.join(", ");
}

const DENSE_EDGES = 150;

const EDGE_COLOR = {
  base: "var(--color-edge)",
  outgoing: "var(--color-primary)",
  incoming: "var(--color-accent-strong)",
  cycle: "var(--color-cycle)",
} as const;

export function toFlowElements(
  vg: { nodes: DisplayNode[]; drawn: DrawnEdge[] },
  { positions, routes }: LayoutData,
  { highlight, matches, selectedId }: FlowOptions,
): { nodes: ModuleFlowNode[]; edges: Edge[] } {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const e of vg.drawn) {
    fanOut.set(e.source, (fanOut.get(e.source) ?? 0) + 1);
    fanIn.set(e.target, (fanIn.get(e.target) ?? 0) + 1);
  }

  const nodes: ModuleFlowNode[] = [];
  for (const n of vg.nodes) {
    const pos = positions.get(n.id);
    if (!pos) continue;
    const role = highlight.nodes.get(n.id) ?? null;
    const match = matches?.has(n.id) ?? false;
    const dim = highlight.active ? role === null : matches !== null ? !match : false;
    const data: ModuleNodeData = {
      node: n,
      role,
      match,
      dim,
      fanIn: fanIn.get(n.id) ?? 0,
      fanOut: fanOut.get(n.id) ?? 0,
    };
    const selected = n.id === selectedId;
    nodes.push({
      id: n.id,
      type: "module",
      position: pos,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      draggable: false,
      selected,
      ariaLabel: nodeAriaLabel(data, selected),
      data,
    });
  }

  // Dense graphs: thin, translucent base edges keep the nodes legible; highlighted edges stay solid.
  const dense = vg.drawn.length > DENSE_EDGES;
  const edges: Edge[] = [];
  for (const e of vg.drawn) {
    if (!positions.has(e.source) || !positions.has(e.target)) continue;
    const role = highlight.edges.get(e.id) ?? null;
    const dim = highlight.active
      ? role === null
      : matches !== null
        ? !(matches.has(e.source) && matches.has(e.target))
        : false;
    const color = role ? EDGE_COLOR[role] : EDGE_COLOR.base;
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "route",
      selectable: false,
      focusable: false,
      zIndex: role ? 10 : 0,
      markerEnd: { type: "arrowclosed" as MarkerType, color, width: 16, height: 16 },
      style: {
        stroke: color,
        strokeWidth: role ? 2.5 : dense ? 1 : 1.5,
        strokeDasharray: e.dependencyClass === "type-only" ? "7 5" : undefined,
        opacity: dim ? 0.18 : dense && !role ? 0.4 : 1,
      },
      data: { role, dependencyClass: e.dependencyClass, dim, points: routes.get(e.id) ?? null },
    });
  }
  return { nodes, edges };
}
