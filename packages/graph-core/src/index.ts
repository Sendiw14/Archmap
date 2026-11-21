import { createHash } from "node:crypto";
import type { ArchmapGraph, Finding, GraphEdge } from "@archmap/graph-schema";

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

const hashId = (prefix: string, parts: string[]) =>
  `${prefix}:${createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 16)}`;

function cycleEvidence(index: GraphIndex, members: string[]): string[] {
  const set = new Set(members);
  const ids: string[] = [];
  for (const s of members)
    for (const t of index.out.get(s) ?? [])
      if (set.has(t)) for (const e of index.edgesByPair.get(`${s}\0${t}`) ?? []) ids.push(e.id);
  return ids.sort();
}

/**
 * Deterministic findings over internal file nodes.
 * - runtime-cycle: cycle using only runtime edges (warning).
 * - type-cycle: cycle that exists only once type-only edges are included (info).
 * - hotspot: fanIn+fanOut >= max(8, ceil(mean + 2*stddev)) over file nodes (info).
 * - unresolved: one finding per file with unresolved imports (warning).
 */
export function computeFindings(graph: Pick<ArchmapGraph, "nodes" | "edges">): Finding[] {
  const fileGraph = {
    nodes: graph.nodes.filter((n) => n.kind === "file"),
    edges: graph.edges.filter((e) => e.target?.startsWith("file:")),
  };
  const findings: Finding[] = [];
  const runtime = buildIndex(fileGraph, { typeOnly: false });
  const all = buildIndex(fileGraph);
  const runtimeKeys = new Set<string>();

  for (const c of findCycles(runtime)) {
    runtimeKeys.add(c.join("\0"));
    findings.push({
      id: hashId("finding", ["runtime-cycle", ...c]),
      category: "runtime-cycle",
      severity: "warning",
      nodes: c,
      evidence: cycleEvidence(runtime, c),
      explanation:
        c.length === 1
          ? `Module imports itself through runtime imports.`
          : `${c.length} modules form a circular dependency through runtime imports.`,
      rule: RULES.cycle,
    });
  }
  for (const c of findCycles(all)) {
    if (runtimeKeys.has(c.join("\0"))) continue;
    findings.push({
      id: hashId("finding", ["type-cycle", ...c]),
      category: "type-cycle",
      severity: "info",
      nodes: c,
      evidence: cycleEvidence(all, c),
      explanation: `${c.length} module(s) form a cycle that involves type-only imports; type-only edges are erased at runtime.`,
      rule: RULES.cycle,
    });
  }

  const metrics = nodeMetrics(all);
  const coupling = [...metrics.entries()].map(([id, m]) => [id, m.fanIn + m.fanOut] as const);
  if (coupling.length > 0) {
    const mean = coupling.reduce((s, [, v]) => s + v, 0) / coupling.length;
    const sd = Math.sqrt(coupling.reduce((s, [, v]) => s + (v - mean) ** 2, 0) / coupling.length);
    const threshold = Math.max(8, Math.ceil(mean + 2 * sd));
    for (const [id, v] of coupling) {
      if (v < threshold) continue;
      const m = metrics.get(id)!;
      findings.push({
        id: hashId("finding", ["hotspot", id]),
        category: "hotspot",
        severity: "info",
        nodes: [id],
        evidence: [],
        explanation: `High coupling: fan-in ${m.fanIn}, fan-out ${m.fanOut} (threshold ${threshold}).`,
        rule: RULES.hotspot,
      });
    }
  }

  const unresolvedByFile = new Map<string, string[]>();
  for (const e of graph.edges)
    if (e.resolution === "unresolved")
      unresolvedByFile.set(e.source, [...(unresolvedByFile.get(e.source) ?? []), e.id]);
  for (const [file, ids] of unresolvedByFile)
    findings.push({
      id: hashId("finding", ["unresolved", file]),
      category: "unresolved",
      severity: "warning",
      nodes: [file],
      evidence: ids.sort(),
      explanation: `${ids.length} import(s) could not be resolved to a file in the repository.`,
      rule: RULES.unresolved,
    });

  return findings.sort((a, b) => (a.id < b.id ? -1 : 1));
}
