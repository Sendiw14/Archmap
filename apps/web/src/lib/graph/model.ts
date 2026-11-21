import type {
  ArchmapGraph,
  DependencyClass,
  Finding,
  GraphEdge,
  GraphNode,
} from "@archmap/graph-schema";

/** Pure view-model derivations. No React, no DOM: everything here is unit-tested. */

export interface ViewFilters {
  showExternals: boolean;
  showTypeOnly: boolean;
}
export const DEFAULT_FILTERS: ViewFilters = { showExternals: true, showTypeOnly: true };

/** One drawn line per (importer, imported) pair; evidence stays per underlying edge. */
export interface DrawnEdge {
  id: string;
  source: string;
  target: string;
  edgeIds: string[];
  dependencyClass: DependencyClass;
}

export interface VisibleGraph {
  nodes: GraphNode[];
  nodeById: Map<string, GraphNode>;
  visibleIds: Set<string>;
  /** Resolved edges whose endpoints and class pass the filters (self-imports included). */
  edges: GraphEdge[];
  visibleEdgeIds: Set<string>;
  /** Lines to draw (no self-imports). */
  drawn: DrawnEdge[];
  /** Never drawn; listed in the UI. */
  unresolved: GraphEdge[];
  hidden: { externalEdges: number; typeOnlyEdges: number };
}

const byPath = (a: GraphNode, b: GraphNode) =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function deriveVisible(graph: ArchmapGraph, filters: ViewFilters): VisibleGraph {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodes = graph.nodes.filter((n) => filters.showExternals || n.kind === "file").sort(byPath);
  const visibleIds = new Set(nodes.map((n) => n.id));

  const edges: GraphEdge[] = [];
  const unresolved: GraphEdge[] = [];
  const hidden = { externalEdges: 0, typeOnlyEdges: 0 };
  for (const e of graph.edges) {
    if (e.target === null) {
      unresolved.push(e);
      continue;
    }
    if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) {
      hidden.externalEdges++;
      continue;
    }
    if (!filters.showTypeOnly && e.dependencyClass === "type-only") {
      hidden.typeOnlyEdges++;
      continue;
    }
    edges.push(e);
  }

  const pairs = new Map<string, DrawnEdge>();
  for (const e of edges) {
    if (e.target === null || e.source === e.target) continue;
    const id = `${e.source}>>${e.target}`;
    const cur = pairs.get(id);
    if (cur) {
      cur.edgeIds.push(e.id);
      if (e.dependencyClass === "runtime") cur.dependencyClass = "runtime";
    } else {
      pairs.set(id, {
        id,
        source: e.source,
        target: e.target,
        edgeIds: [e.id],
        dependencyClass: e.dependencyClass,
      });
    }
  }
  return {
    nodes,
    nodeById,
    visibleIds,
    edges,
    visibleEdgeIds: new Set(edges.map((e) => e.id)),
    drawn: [...pairs.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
    unresolved,
    hidden,
  };
}

/* ---------------------------------------------------------------- highlight */

export type Focus = { kind: "node"; id: string } | { kind: "cycle"; id: string };
export type NodeRole = "selected" | "dependency" | "dependent" | "both" | "member";
export type EdgeRole = "outgoing" | "incoming" | "cycle";

export interface Highlight {
  active: boolean;
  nodes: Map<string, NodeRole>;
  edges: Map<string, EdgeRole>;
}
export const NO_HIGHLIGHT: Highlight = { active: false, nodes: new Map(), edges: new Map() };

/** Which neighbours of the selection to highlight. */
export type Direction = "both" | "incoming" | "outgoing";

export interface HighlightOptions {
  direction?: Direction;
  /** Maps a module id to the id drawn for it (a group when its folder is collapsed). */
  itemOf?: Map<string, string>;
}

export function computeHighlight(
  vg: Pick<VisibleGraph, "visibleIds" | "drawn">,
  focus: Focus | null,
  findings: Finding[],
  { direction = "both", itemOf }: HighlightOptions = {},
): Highlight {
  if (!focus) return NO_HIGHLIGHT;
  const nodes = new Map<string, NodeRole>();
  const edges = new Map<string, EdgeRole>();
  const drawnId = (id: string) => itemOf?.get(id) ?? id;

  if (focus.kind === "node") {
    const self = drawnId(focus.id);
    if (!vg.visibleIds.has(self)) return NO_HIGHLIGHT;
    nodes.set(self, "selected");
    for (const e of vg.drawn) {
      if (e.source === self && direction !== "incoming") {
        edges.set(e.id, "outgoing");
        nodes.set(e.target, nodes.get(e.target) === "dependent" ? "both" : "dependency");
      } else if (e.target === self && direction !== "outgoing") {
        edges.set(e.id, "incoming");
        nodes.set(e.source, nodes.get(e.source) === "dependency" ? "both" : "dependent");
      }
    }
    return { active: true, nodes, edges };
  }

  const finding = findings.find((f) => f.id === focus.id);
  if (!finding) return NO_HIGHLIGHT;
  for (const id of finding.nodes) {
    const shown = drawnId(id);
    if (vg.visibleIds.has(shown)) nodes.set(shown, "member");
  }
  const evidence = new Set(finding.evidence);
  for (const e of vg.drawn) if (e.edgeIds.some((id) => evidence.has(id))) edges.set(e.id, "cycle");
  return { active: true, nodes, edges };
}

/* --------------------------------------------------------------- inspection */

export interface EvidenceRow {
  id: string;
  specifier: string;
  importKind: GraphEdge["importKind"];
  dependencyClass: DependencyClass;
  /** `file:line:column` */
  location: string;
  text: string;
  sourcePath: string;
  targetPath: string | null;
}

export interface PeerGroup {
  peer: GraphNode;
  classes: DependencyClass[];
  evidence: EvidenceRow[];
}

export interface NodeInspection {
  node: GraphNode;
  outgoing: PeerGroup[];
  incoming: PeerGroup[];
  unresolved: EvidenceRow[];
  findings: Finding[];
  hidden: { externalEdges: number; typeOnlyEdges: number };
}

export function evidenceRow(e: GraphEdge, nodeById: Map<string, GraphNode>): EvidenceRow {
  return {
    id: e.id,
    specifier: e.specifier,
    importKind: e.importKind,
    dependencyClass: e.dependencyClass,
    location: `${e.evidence.file}:${e.evidence.line}:${e.evidence.column}`,
    text: e.evidence.text,
    sourcePath: nodeById.get(e.source)?.path ?? e.source,
    targetPath: e.target ? (nodeById.get(e.target)?.path ?? e.target) : null,
  };
}

function groupByPeer(
  edges: GraphEdge[],
  peerOf: (e: GraphEdge) => string,
  vg: VisibleGraph,
): PeerGroup[] {
  const groups = new Map<string, PeerGroup>();
  for (const e of edges) {
    const peer = vg.nodeById.get(peerOf(e));
    if (!peer) continue;
    let g = groups.get(peer.id);
    if (!g) groups.set(peer.id, (g = { peer, classes: [], evidence: [] }));
    if (!g.classes.includes(e.dependencyClass)) g.classes.push(e.dependencyClass);
    g.evidence.push(evidenceRow(e, vg.nodeById));
  }
  const out = [...groups.values()];
  for (const g of out) {
    g.classes.sort();
    g.evidence.sort((a, b) => (a.location < b.location ? -1 : a.location > b.location ? 1 : 0));
  }
  return out.sort((a, b) => byPath(a.peer, b.peer));
}

export function inspectNode(
  graph: ArchmapGraph,
  vg: VisibleGraph,
  nodeId: string,
): NodeInspection | null {
  const node = vg.nodeById.get(nodeId);
  if (!node) return null;
  const hidden = { externalEdges: 0, typeOnlyEdges: 0 };
  for (const e of graph.edges) {
    if (e.target === null || (e.source !== nodeId && e.target !== nodeId)) continue;
    if (vg.visibleEdgeIds.has(e.id)) continue;
    if (!vg.visibleIds.has(e.source) || !vg.visibleIds.has(e.target)) hidden.externalEdges++;
    else hidden.typeOnlyEdges++;
  }
  return {
    node,
    outgoing: groupByPeer(
      vg.edges.filter((e) => e.source === nodeId),
      (e) => e.target as string,
      vg,
    ),
    incoming: groupByPeer(
      vg.edges.filter((e) => e.target === nodeId),
      (e) => e.source,
      vg,
    ),
    unresolved: vg.unresolved
      .filter((e) => e.source === nodeId)
      .map((e) => evidenceRow(e, vg.nodeById)),
    findings: graph.findings.filter((f) => f.nodes.includes(nodeId)),
    hidden,
  };
}

/* -------------------------------------------------------------- module list */

export interface ModuleRow {
  id: string;
  path: string;
  displayName: string;
  kind: GraphNode["kind"];
  package: string | null;
  language: GraphNode["language"];
  /** Display names of distinct imported modules (self excluded). */
  imports: string[];
  importCount: number;
  importedByCount: number;
}

export function moduleRows(vg: VisibleGraph): ModuleRow[] {
  const out = new Map<string, Set<string>>();
  const inn = new Map<string, Set<string>>();
  for (const e of vg.drawn) {
    (out.get(e.source) ?? out.set(e.source, new Set()).get(e.source)!).add(e.target);
    (inn.get(e.target) ?? inn.set(e.target, new Set()).get(e.target)!).add(e.source);
  }
  return vg.nodes.map((n) => {
    const imports = [...(out.get(n.id) ?? [])]
      .map((id) => vg.nodeById.get(id)?.displayName ?? id)
      .sort();
    return {
      id: n.id,
      path: n.path,
      displayName: n.displayName,
      kind: n.kind,
      package: n.package,
      language: n.language,
      imports,
      importCount: imports.length,
      importedByCount: inn.get(n.id)?.size ?? 0,
    };
  });
}

/* ------------------------------------------------------------------- cycles */

export interface CycleItem {
  id: string;
  finding: Finding;
  kind: "runtime" | "type-only";
  title: string;
  members: GraphNode[];
  evidence: EvidenceRow[];
  usesTypeOnly: boolean;
}

export function cycleItems(graph: ArchmapGraph): CycleItem[] {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgeById = new Map(graph.edges.map((e) => [e.id, e]));
  const items: CycleItem[] = [];
  for (const f of graph.findings) {
    if (f.category !== "runtime-cycle" && f.category !== "type-cycle") continue;
    const members = f.nodes.flatMap((id) => nodeById.get(id) ?? []);
    const edges = f.evidence.flatMap((id) => edgeById.get(id) ?? []);
    const kind = f.category === "runtime-cycle" ? "runtime" : "type-only";
    items.push({
      id: f.id,
      finding: f,
      kind,
      title: `${kind === "runtime" ? "Runtime" : "Type-only"} cycle, ${members.length} modules`,
      members,
      evidence: edges.map((e) => evidenceRow(e, nodeById)),
      usesTypeOnly: edges.some((e) => e.dependencyClass === "type-only"),
    });
  }
  return items;
}

/** Most-imported file, used as the walkthrough's example selection. */
export function mostImportedFile(vg: VisibleGraph): string | null {
  const counts = new Map<string, number>();
  for (const e of vg.drawn) counts.set(e.target, (counts.get(e.target) ?? 0) + 1);
  let best: string | null = null;
  for (const n of vg.nodes) {
    if (n.kind !== "file") continue;
    if (best === null || (counts.get(n.id) ?? 0) > (counts.get(best) ?? 0)) best = n.id;
  }
  return best;
}
