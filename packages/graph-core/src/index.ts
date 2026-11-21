import type { ArchmapGraph, GraphEdge } from "@archmap/graph-schema";

export const RULES = {
  cycle: "scc-tarjan@1",
  hotspot: "coupling-zscore@1",
  unresolved: "unresolved-import@1",
} as const;

export interface EdgeFilter {
  /** Include type-only edges. Default true. */
  typeOnly?: boolean;
}

/** Adjacency over resolved edges between graph nodes (source -> target). */
export interface GraphIndex {
  nodes: string[];
  out: Map<string, Set<string>>;
  in: Map<string, Set<string>>;
  /** Edges grouped by "source\0target". */
  edgesByPair: Map<string, GraphEdge[]>;
}

export function buildIndex(
  graph: Pick<ArchmapGraph, "nodes" | "edges">,
  filter: EdgeFilter = {},
): GraphIndex {
  const typeOnly = filter.typeOnly ?? true;
  const nodes = graph.nodes.map((n) => n.id).sort();
  const out = new Map<string, Set<string>>();
  const inn = new Map<string, Set<string>>();
  for (const id of nodes) {
    out.set(id, new Set());
    inn.set(id, new Set());
  }
  const edgesByPair = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) {
    if (e.target === null) continue;
    if (!typeOnly && e.dependencyClass === "type-only") continue;
    out.get(e.source)?.add(e.target);
    inn.get(e.target)?.add(e.source);
    const key = `${e.source}\0${e.target}`;
    const list = edgesByPair.get(key);
    if (list) list.push(e);
    else edgesByPair.set(key, [e]);
  }
  return { nodes, out, in: inn, edgesByPair };
}

const sorted = (s: Iterable<string> | undefined) => [...(s ?? [])].sort();

/**
 * Tarjan's strongly connected components, iterative (no recursion-depth limit).
 * Returns components with members sorted, components sorted by first member.
 */
export function stronglyConnectedComponents(index: GraphIndex): string[][] {
  let counter = 0;
  const num = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const result: string[][] = [];

  for (const root of index.nodes) {
    if (num.has(root)) continue;
    const work: { v: string; succ: string[]; i: number }[] = [];
    const visit = (v: string) => {
      num.set(v, counter);
      low.set(v, counter);
      counter++;
      stack.push(v);
      onStack.add(v);
      work.push({ v, succ: sorted(index.out.get(v)), i: 0 });
    };
    visit(root);
    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      if (frame.i < frame.succ.length) {
        const w = frame.succ[frame.i++]!;
        if (!num.has(w)) visit(w);
        else if (onStack.has(w)) low.set(frame.v, Math.min(low.get(frame.v)!, num.get(w)!));
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent) low.set(parent.v, Math.min(low.get(parent.v)!, low.get(frame.v)!));
      if (low.get(frame.v) === num.get(frame.v)) {
        const comp: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          comp.push(w);
        } while (w !== frame.v);
        result.push(comp.sort());
      }
    }
  }
  return result.sort((a, b) => (a[0]! < b[0]! ? -1 : 1));
}

/** Components that form a cycle: size > 1, or a singleton with a self-loop. */
export function findCycles(index: GraphIndex): string[][] {
  return stronglyConnectedComponents(index).filter(
    (c) => c.length > 1 || index.out.get(c[0]!)?.has(c[0]!),
  );
}

export interface ImpactResult {
  node: string;
  direct: string[];
  transitive: string[];
  /** For each dependent: shortest path dependent -> ... -> node (import direction). */
  paths: Record<string, string[]>;
}

/**
 * Potential change impact: every module that (transitively) imports `node`.
 * Static reachability only; it does not mean those modules will break.
 */
export function potentialImpact(
  index: GraphIndex,
  node: string,
  maxDepth = Infinity,
): ImpactResult {
  const parent = new Map<string, string>(); // dependent -> next hop toward node
  const depth = new Map<string, number>([[node, 0]]);
  const queue = [node];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    if (d >= maxDepth) continue;
    for (const dep of sorted(index.in.get(cur))) {
      if (depth.has(dep)) continue;
      depth.set(dep, d + 1);
      parent.set(dep, cur);
      queue.push(dep);
    }
  }
  const direct = sorted(index.in.get(node)).filter((d) => d !== node);
  const transitive = [...depth.keys()].filter((k) => k !== node).sort();
  const paths: Record<string, string[]> = {};
  for (const t of transitive) {
    const p = [t];
    let cur = t;
    while (cur !== node) {
      cur = parent.get(cur)!;
      p.push(cur);
    }
    paths[t] = p;
  }
  return { node, direct, transitive, paths };
}

/** Shortest dependency path from `from` to `to` following import direction, or null. */
export function dependencyPath(index: GraphIndex, from: string, to: string): string[] | null {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === to) {
      const path = [to];
      let p = prev.get(to);
      while (p != null) {
        path.unshift(p);
        p = prev.get(p);
      }
      return path;
    }
    for (const n of sorted(index.out.get(cur))) {
      if (!prev.has(n)) {
        prev.set(n, cur);
        queue.push(n);
      }
    }
  }
  return null;
}

export interface NodeMetrics {
  fanIn: number;
  fanOut: number;
}

export function nodeMetrics(index: GraphIndex): Map<string, NodeMetrics> {
  const m = new Map<string, NodeMetrics>();
  for (const id of index.nodes) {
    const outs = index.out.get(id)!;
    const ins = index.in.get(id)!;
    m.set(id, {
      fanIn: ins.size - (ins.has(id) ? 1 : 0),
      fanOut: outs.size - (outs.has(id) ? 1 : 0),
    });
  }
  return m;
}

export interface PackageEdge {
  source: string;
  target: string;
  count: number;
  edges: string[];
}

/** Aggregate file-level edges into package-level edges (cross-package only). */
export function aggregateByPackage(graph: Pick<ArchmapGraph, "nodes" | "edges">): PackageEdge[] {
  const pkgOf = new Map(graph.nodes.map((n) => [n.id, n.kind === "file" ? n.package : n.path]));
  const agg = new Map<string, PackageEdge>();
  for (const e of graph.edges) {
    if (e.target === null) continue;
    const s = pkgOf.get(e.source);
    const t = pkgOf.get(e.target);
    if (!s || !t || s === t) continue;
    const key = `${s}\0${t}`;
    const cur = agg.get(key) ?? { source: s, target: t, count: 0, edges: [] };
    cur.count++;
    cur.edges.push(e.id);
    agg.set(key, cur);
  }
  return [...agg.values()]
    .map((p) => ({ ...p, edges: p.edges.sort() }))
    .sort((a, b) => (a.source + "\0" + a.target < b.source + "\0" + b.target ? -1 : 1));
}
