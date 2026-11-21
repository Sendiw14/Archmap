import { aggregateByPackage } from "./index.ts";
import type { ArchmapGraph } from "@archmap/graph-schema";

const esc = (s: string) => s.replace(/[|`<>]/g, (c) => `\\${c}`);
const name = (id: string) => id.replace(/^(file|external|builtin):/, "");

/** Deterministic Markdown report derived only from the graph. */
export function toMarkdown(g: ArchmapGraph): string {
  const m = g.metadata;
  const files = g.nodes.filter((n) => n.kind === "file");
  const externals = g.nodes.filter((n) => n.kind !== "file");
  const byCat = (c: string) => g.findings.filter((f) => f.category === c);
  const out: string[] = [];
  out.push(`# ARCHMAP report: ${esc(m.repository.name)}`, "");
  out.push(
    "| Field | Value |",
    "| --- | --- |",
    `| Commit | ${m.repository.commit ?? "not a git checkout"} |`,
    `| Status | ${m.status} |`,
    `| Analyzer | ${m.analyzerVersion} (${m.compilerVersion}) |`,
    `| Schema | ${m.schemaVersion} |`,
    `| Analysis ID | ${m.analysisId} |`,
    `| Generated | ${m.generatedAt ?? "reproducible mode"} |`,
    "",
  );
  out.push("## Summary", "");
  out.push(
    `- Source files analyzed: ${m.counts.filesAnalyzed} (discovered ${m.counts.filesDiscovered}, excluded ${m.counts.filesExcluded}, skipped ${m.counts.filesSkipped})`,
    `- Module nodes: ${files.length} files, ${externals.length} external/builtin packages`,
    `- Dependency edges: ${g.edges.length} (${
      Object.entries(g.coverage.resolutions)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ") || "none"
    })`,
    `- Runtime cycles: ${byCat("runtime-cycle").length}; type-involved cycles: ${byCat("type-cycle").length}`,
    "",
  );
  const cycles = [...byCat("runtime-cycle"), ...byCat("type-cycle")];
  if (cycles.length) {
    out.push("## Cycles", "");
    for (const f of cycles)
      out.push(
        `- **${f.category}** (${f.nodes.length}): ${f.nodes.map((n) => `\`${esc(name(n))}\``).join(" → ")}`,
      );
    out.push("");
  }
  const hot = byCat("hotspot");
  if (hot.length) {
    out.push("## Coupling hotspots", "");
    for (const f of hot) out.push(`- \`${esc(name(f.nodes[0]!))}\`: ${esc(f.explanation)}`);
    out.push("");
  }
  const pkgs = aggregateByPackage(g);
  if (pkgs.length) {
    out.push("## Package dependencies", "", "| From | To | Edges |", "| --- | --- | --- |");
    for (const p of pkgs) out.push(`| ${esc(p.source)} | ${esc(p.target)} | ${p.count} |`);
    out.push("");
  }
  const unresolved = g.edges.filter((e) => e.resolution === "unresolved");
  if (unresolved.length) {
    out.push(
      "## Unresolved imports",
      "",
      "| File | Line | Specifier | Reason |",
      "| --- | --- | --- | --- |",
    );
    for (const e of unresolved)
      out.push(
        `| ${esc(e.evidence.file)} | ${e.evidence.line} | \`${esc(e.specifier)}\` | ${esc(e.diagnostic ?? "")} |`,
      );
    out.push("");
  }
  if (g.diagnostics.length) {
    out.push("## Diagnostics", "");
    for (const d of g.diagnostics) {
      const where = d.location ? `${d.location.file}:${d.location.line}` : (d.file ?? "");
      out.push(`- [${d.severity}] ${d.code}${where ? ` (${esc(where)})` : ""}: ${esc(d.message)}`);
    }
    out.push("");
  }
  out.push(
    "## Limitations",
    "",
    "- Static analysis of source-level module references only; runtime-computed imports, plugins, and framework conventions are not inferred.",
    '- "Potential change impact" means static reachability, not a guarantee that dependents will break.',
    "- Type-only edges are erased at runtime and are reported separately from runtime dependencies.",
    "- Supported constructs:",
    ...g.coverage.supportedConstructs.map((c) => `  - ${c}`),
    "",
  );
  return out.join("\n");
}
