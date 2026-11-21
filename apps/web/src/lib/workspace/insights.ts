import type {
  ArchmapGraph,
  Diagnostic,
  Finding,
  GraphEdge,
  GraphNode,
} from "@archmap/graph-schema";
import { aggregateByPackage, buildIndex, nodeMetrics, type PackageEdge } from "@archmap/graph-core";
import { cycleItems, type CycleItem } from "../graph/model";

/** Pure derivations behind /insights and /report. Everything comes from the validated graph. */

export interface RepoMetrics {
  files: number;
  externals: number;
  builtins: number;
  packages: number;
  edges: number;
  resolved: number;
  external: number;
  unresolved: number;
  runtimeEdges: number;
  typeOnlyEdges: number;
  runtimeCycles: number;
  typeCycles: number;
  hotspots: number;
  diagnostics: number;
  /** Mean imports per file over resolved file-to-file edges (distinct targets). */
  meanFanOut: number;
}

export interface CouplingRow {
  node: GraphNode;
  fanIn: number;
  fanOut: number;
  total: number;
}

export interface Insights {
  metrics: RepoMetrics;
  cycles: CycleItem[];
  coupling: CouplingRow[];
  hotspots: { finding: Finding; node: GraphNode | null }[];
  packageEdges: PackageEdge[];
  packages: PackageSummary[];
  unresolved: GraphEdge[];
  diagnostics: Diagnostic[];
}

export interface PackageSummary {
  name: string;
  files: number;
  /** Distinct other packages this one imports from / that import it. */
  dependsOn: number;
  dependedOnBy: number;
}

const byTotal = (a: CouplingRow, b: CouplingRow) =>
  b.total - a.total || (a.node.path < b.node.path ? -1 : 1);

export function deriveInsights(graph: ArchmapGraph): Insights {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const files = graph.nodes.filter((n) => n.kind === "file");
  const count = (c: Finding["category"]) => graph.findings.filter((f) => f.category === c).length;

  const index = buildIndex({
    nodes: files,
    edges: graph.edges.filter((e) => e.target?.startsWith("file:")),
  });
  const metrics = nodeMetrics(index);
  const coupling: CouplingRow[] = files
    .map((node) => {
      const m = metrics.get(node.id) ?? { fanIn: 0, fanOut: 0 };
      return { node, fanIn: m.fanIn, fanOut: m.fanOut, total: m.fanIn + m.fanOut };
    })
    .sort(byTotal);
  const meanFanOut = files.length ? coupling.reduce((s, r) => s + r.fanOut, 0) / files.length : 0;

  const packageEdges = aggregateByPackage(graph).filter((p) =>
    graph.nodes.some((n) => n.kind === "file" && n.package === p.source),
  );
  const names = new Set<string>();
  for (const n of files) if (n.package) names.add(n.package);
  const packages: PackageSummary[] = [...names].sort().map((name) => ({
    name,
    files: files.filter((n) => n.package === name).length,
    dependsOn: new Set(packageEdges.filter((p) => p.source === name).map((p) => p.target)).size,
    dependedOnBy: new Set(packageEdges.filter((p) => p.target === name).map((p) => p.source)).size,
  }));

  const edgeCount = (r: GraphEdge["resolution"]) =>
    graph.edges.filter((e) => e.resolution === r).length;
  return {
    metrics: {
      files: files.length,
      externals: graph.nodes.filter((n) => n.kind === "external").length,
      builtins: graph.nodes.filter((n) => n.kind === "builtin").length,
      packages: names.size,
      edges: graph.edges.length,
      resolved: edgeCount("resolved"),
      external: edgeCount("external"),
      unresolved: edgeCount("unresolved"),
      runtimeEdges: graph.edges.filter((e) => e.dependencyClass === "runtime").length,
      typeOnlyEdges: graph.edges.filter((e) => e.dependencyClass === "type-only").length,
      runtimeCycles: count("runtime-cycle"),
      typeCycles: count("type-cycle"),
      hotspots: count("hotspot"),
      diagnostics: graph.diagnostics.length,
      meanFanOut,
    },
    cycles: cycleItems(graph),
    coupling,
    hotspots: graph.findings
      .filter((f) => f.category === "hotspot")
      .map((finding) => ({ finding, node: nodeById.get(finding.nodes[0] ?? "") ?? null })),
    packageEdges,
    packages,
    unresolved: graph.edges.filter((e) => e.resolution === "unresolved"),
    diagnostics: graph.diagnostics,
  };
}
