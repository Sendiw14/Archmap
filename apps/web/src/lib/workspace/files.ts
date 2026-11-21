import type { ArchmapGraph, GraphEdge, GraphNode } from "@archmap/graph-schema";

/**
 * Per-file view for /files. ARCHMAP v1 records module-level edges, not symbols: this
 * deliberately exposes imports and re-exports as edges with their source evidence and nothing
 * about which names are imported or exported.
 */

export interface FileEdgeRow {
  edge: GraphEdge;
  /** The module on the other end (null for unresolved imports). */
  peer: GraphNode | null;
}

export interface FileDetail {
  node: GraphNode;
  imports: FileEdgeRow[];
  /** Outgoing edges of kind "export" (`export ... from`). */
  reExports: FileEdgeRow[];
  importedBy: FileEdgeRow[];
  unresolved: FileEdgeRow[];
}

export interface FileIndex {
  nodeById: Map<string, GraphNode>;
  bySource: Map<string, GraphEdge[]>;
  byTarget: Map<string, GraphEdge[]>;
}

export function buildFileIndex(graph: ArchmapGraph): FileIndex {
  const bySource = new Map<string, GraphEdge[]>();
  const byTarget = new Map<string, GraphEdge[]>();
  const push = (m: Map<string, GraphEdge[]>, k: string, e: GraphEdge) => {
    const l = m.get(k);
    if (l) l.push(e);
    else m.set(k, [e]);
  };
  for (const e of graph.edges) {
    push(bySource, e.source, e);
    if (e.target) push(byTarget, e.target, e);
  }
  return { nodeById: new Map(graph.nodes.map((n) => [n.id, n])), bySource, byTarget };
}

const at = (a: FileEdgeRow, b: FileEdgeRow) =>
  a.edge.evidence.line - b.edge.evidence.line || a.edge.evidence.column - b.edge.evidence.column;

export function fileDetail(index: FileIndex, nodeId: string): FileDetail | null {
  const node = index.nodeById.get(nodeId);
  if (!node) return null;
  const out = (index.bySource.get(nodeId) ?? []).map<FileEdgeRow>((edge) => ({
    edge,
    peer: edge.target ? (index.nodeById.get(edge.target) ?? null) : null,
  }));
  const inn = (index.byTarget.get(nodeId) ?? [])
    .filter((e) => e.source !== nodeId)
    .map<FileEdgeRow>((edge) => ({ edge, peer: index.nodeById.get(edge.source) ?? null }));
  return {
    node,
    imports: out
      .filter((r) => r.edge.resolution !== "unresolved" && r.edge.importKind !== "export")
      .sort(at),
    reExports: out
      .filter((r) => r.edge.resolution !== "unresolved" && r.edge.importKind === "export")
      .sort(at),
    importedBy: inn.sort((a, b) =>
      (a.peer?.path ?? "") < (b.peer?.path ?? "")
        ? -1
        : (a.peer?.path ?? "") > (b.peer?.path ?? "")
          ? 1
          : at(a, b),
    ),
    unresolved: out.filter((r) => r.edge.resolution === "unresolved").sort(at),
  };
}
