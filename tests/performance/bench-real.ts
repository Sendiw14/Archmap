// Usage: node tests/performance/bench-real.ts <dir>... (one process per dir for clean peak RSS)
import { analyze } from "@archmap/analyzer";
for (const dir of process.argv.slice(2)) {
  const t = performance.now();
  const { graph, timings } = analyze(dir, { reproducible: true, maxFiles: 20000 });
  const total = performance.now() - t;
  const ser = performance.now();
  const json = JSON.stringify(graph);
  const serMs = performance.now() - ser;
  console.log(
    JSON.stringify({
      dir: dir.split("node_modules/").pop(),
      files: graph.metadata.counts.filesAnalyzed,
      edges: graph.edges.length,
      unresolved: graph.coverage.resolutions.unresolved ?? 0,
      cycles: graph.findings.filter((f) => f.category === "runtime-cycle").length,
      ...timings,
      serializeMs: Math.round(serMs),
      totalMs: Math.round(total),
      jsonMB: +(json.length / 1e6).toFixed(1),
      peakRssMB: Math.round(process.resourceUsage().maxRSS / 1024),
    }),
  );
}
