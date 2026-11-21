import { createHash } from "node:crypto";
import type { ArchmapGraph, Finding } from "@archmap/graph-schema";
import { RULES, buildIndex, findCycles, nodeMetrics, type GraphIndex } from "./index.ts";

// Node-only (node:crypto). Browser code imports algorithms from "@archmap/graph-core" instead.
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
