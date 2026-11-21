import type { GraphNode, Language, NodeKind } from "@archmap/graph-schema";
import type { DrawnEdge, VisibleGraph } from "../graph/model";
import { allBranchIds, ancestorMap, buildTree, leafIds, type GroupBy, type TreeNode } from "./tree";

/**
 * Large-graph aggregation (spec 9.5, 13.2). Instead of laying out thousands of file nodes,
 * the canvas draws the "frontier" of the tree: folders (or packages) that are collapsed are one
 * node, expanded ones show their children. Edges between frontier items are summed, so the
 * drawn graph is a faithful, lossless-by-expansion summary of the real one.
 */

/** Above this many file nodes the workspace starts grouped. */
export const AGGREGATION_THRESHOLD = 400;
/** Items drawn at once when starting grouped. */
export const INITIAL_ITEM_TARGET = 40;
/** Upper bound for "ungrouped" file-level drawing; beyond it the UI keeps groups. */
export const MAX_FILE_LEVEL_NODES = 1500;

export type DisplayKind = NodeKind | "group";

/** What the canvas draws: a module, or a folder/package standing in for its members. */
export interface DisplayNode {
  id: string;
  kind: DisplayKind;
  path: string;
  displayName: string;
  package: string | null;
  language: Language | null;
  /** Groups only: number of modules inside, and edges that stay inside. */
  memberCount?: number;
  internalEdges?: number;
  groupKind?: "package" | "dir" | "group";
}

export interface DisplayGraph {
  nodes: DisplayNode[];
  nodeById: Map<string, DisplayNode>;
  visibleIds: Set<string>;
  drawn: DrawnEdge[];
  /** Module id -> id of the node that draws it (itself when it is shown individually). */
  itemOf: Map<string, string>;
  groups: number;
}

export type GroupingMode = "auto" | "none" | "directory" | "package";

export const isLarge = (fileNodes: number) => fileNodes > AGGREGATION_THRESHOLD;

/** Resolve the user's grouping choice. "auto" groups by directory only when the graph is large. */
export function effectiveGrouping(mode: GroupingMode, fileNodes: number): GroupBy | "none" {
  if (mode === "auto") return isLarge(fileNodes) ? "directory" : "none";
  return mode;
}

/**
 * Expansion that yields at most ~`target` drawn items: expand the largest groups first, one
 * level at a time, never exceeding the budget.
 */
export function initialExpanded(root: TreeNode, target = INITIAL_ITEM_TARGET): Set<string> {
  const expanded = new Set<string>();
  let items = root.children.length;
  const candidates = root.children.filter((c) => c.nodeId === undefined);
  while (candidates.length > 0) {
    candidates.sort((a, b) => b.count - a.count);
    const t = candidates.shift()!;
    const gain = t.children.length - 1;
    if (items + gain > target) continue;
    expanded.add(t.id);
    items += gain;
    candidates.push(...t.children.filter((c) => c.nodeId === undefined));
  }
  return expanded;
}

export function expandAll(root: TreeNode): Set<string> {
  return allBranchIds(root);
}

/** Expand every ancestor of a module so it becomes visible. */
export function expandTo(
  expanded: ReadonlySet<string>,
  ancestors: Map<string, string[]>,
  nodeId: string,
): Set<string> {
  const next = new Set(expanded);
  for (const a of ancestors.get(nodeId) ?? []) next.add(a);
  return next;
}

/** Collapse the deepest expanded ancestor of a module (the group it currently sits in). */
export function collapseAround(
  expanded: ReadonlySet<string>,
  ancestors: Map<string, string[]>,
  nodeId: string,
): { next: Set<string>; collapsed: string | null } {
  const chain = ancestors.get(nodeId) ?? [];
  for (let i = chain.length - 1; i >= 0; i--) {
    const id = chain[i]!;
    if (expanded.has(id)) {
      const next = new Set(expanded);
      next.delete(id);
      return { next, collapsed: id };
    }
  }
  return { next: new Set(expanded), collapsed: null };
}

const groupName = (t: TreeNode) =>
  t.kind === "dir" ? (t.path ?? t.label) : t.kind === "package" ? t.label : t.label;

/** Draw every module individually. */
export function ungroupedDisplay(vg: VisibleGraph): DisplayGraph {
  const itemOf = new Map(vg.nodes.map((n) => [n.id, n.id]));
  return {
    nodes: vg.nodes,
    nodeById: vg.nodeById,
    visibleIds: vg.visibleIds,
    drawn: vg.drawn,
    itemOf,
    groups: 0,
  };
}

export function deriveDisplay(
  vg: Pick<VisibleGraph, "nodes" | "drawn">,
  tree: TreeNode,
  expanded: ReadonlySet<string>,
): DisplayGraph {
  const nodes: DisplayNode[] = [];
  const itemOf = new Map<string, string>();
  const groupById = new Map<string, DisplayNode>();

  const walk = (t: TreeNode) => {
    for (const c of t.children) {
      if (c.nodeId !== undefined) {
        const n = c.node as GraphNode;
        nodes.push(n);
        itemOf.set(n.id, n.id);
      } else if (expanded.has(c.id)) {
        walk(c);
      } else {
        const g: DisplayNode = {
          id: c.id,
          kind: "group",
          path: groupName(c),
          displayName: c.label,
          package: c.kind === "package" ? c.label : null,
          language: null,
          memberCount: c.count,
          internalEdges: 0,
          groupKind: c.kind === "package" ? "package" : c.kind === "dir" ? "dir" : "group",
        };
        nodes.push(g);
        groupById.set(g.id, g);
        for (const id of leafIds(c)) itemOf.set(id, g.id);
      }
    }
  };
  walk(tree);

  const pairs = new Map<string, DrawnEdge>();
  for (const e of vg.drawn) {
    const s = itemOf.get(e.source);
    const t = itemOf.get(e.target);
    if (!s || !t) continue;
    if (s === t) {
      const g = groupById.get(s);
      if (g) g.internalEdges = (g.internalEdges ?? 0) + e.edgeIds.length;
      continue;
    }
    const id = `${s}>>${t}`;
    const cur = pairs.get(id);
    if (cur) {
      cur.edgeIds.push(...e.edgeIds);
      if (e.dependencyClass === "runtime") cur.dependencyClass = "runtime";
    } else {
      pairs.set(id, {
        id,
        source: s,
        target: t,
        edgeIds: [...e.edgeIds],
        dependencyClass: e.dependencyClass,
      });
    }
  }
  nodes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.id < b.id ? -1 : 1));
  return {
    nodes,
    nodeById: new Map(nodes.map((n) => [n.id, n])),
    visibleIds: new Set(nodes.map((n) => n.id)),
    drawn: [...pairs.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
    itemOf,
    groups: groupById.size,
  };
}

/** Convenience used by tests and the benchmark: tree + initial expansion + display graph. */
export function groupedView(
  vg: VisibleGraph,
  groupBy: GroupBy,
  target = INITIAL_ITEM_TARGET,
): { tree: TreeNode; expanded: Set<string>; display: DisplayGraph } {
  const tree = buildTree(vg.nodes, groupBy);
  const expanded = initialExpanded(tree, target);
  return { tree, expanded, display: deriveDisplay(vg, tree, expanded) };
}

export { ancestorMap };
