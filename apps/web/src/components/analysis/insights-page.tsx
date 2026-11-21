"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RULES } from "@archmap/graph-core";
import { deriveInsights } from "../../lib/workspace/insights";
import { formatCount } from "../../lib/format";
import { Badge } from "../ui/primitives";
import { useReadyAnalysis } from "./provider";
import {
  DiagnosticsTable,
  EmptyNote,
  EvidenceTable,
  NodeLink,
  PageFrame,
  Section,
  Stat,
  Toc,
} from "./parts";

const TOP = 15;

export function InsightsPage() {
  const { id, graph } = useReadyAnalysis();
  const base = `/analyses/${id}`;
  const ins = useMemo(() => deriveInsights(graph), [graph]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const edgeById = useMemo(() => new Map(graph.edges.map((e) => [e.id, e])), [graph]);
  const m = ins.metrics;
  const maxCoupling = Math.max(1, ...ins.coupling.slice(0, TOP).map((r) => r.total));

  return (
    <PageFrame>
      <header className="mb-8">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Insights</h2>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted">
          Everything on this page is computed from the validated dependency graph by deterministic
          rules. Nothing is estimated, sampled or inferred by a model. Each finding links back to
          the source line it came from.
        </p>
        <div className="mt-4">
          <Toc
            items={[
              { id: "metrics", label: "Metrics" },
              { id: "cycles", label: "Cycles" },
              { id: "coupling", label: "Coupling and hotspots" },
              { id: "packages", label: "Packages" },
              { id: "unresolved", label: "Unresolved imports" },
              { id: "diagnostics", label: "Diagnostics" },
              { id: "evidence", label: "Evidence" },
              { id: "methodology", label: "Methodology and limitations" },
            ]}
          />
        </div>
      </header>

      <Section
        id="metrics"
        title="Repository metrics"
        lead={`${formatCount(m.files)} source files analyzed, ${formatCount(m.edges)} import statements recorded.`}
      >
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat
            label="Source files"
            value={formatCount(m.files)}
            hint={`${formatCount(graph.metadata.counts.filesDiscovered)} discovered, ${formatCount(graph.metadata.counts.filesExcluded)} excluded, ${formatCount(graph.metadata.counts.filesSkipped)} skipped`}
          />
          <Stat
            label="External packages"
            value={formatCount(m.externals)}
            hint={`plus ${m.builtins} Node.js built-ins`}
          />
          <Stat label="Workspace packages" value={formatCount(m.packages)} />
          <Stat
            label="Imports"
            value={formatCount(m.edges)}
            hint={`${formatCount(m.runtimeEdges)} runtime, ${formatCount(m.typeOnlyEdges)} type-only`}
          />
          <Stat
            label="Resolved to a file"
            value={formatCount(m.resolved)}
            hint={`${formatCount(m.external)} to external or built-in modules`}
          />
          <Stat
            label="Unresolved"
            value={formatCount(m.unresolved)}
            hint="not drawn in the graph; listed below"
          />
          <Stat
            label="Runtime cycles"
            value={formatCount(m.runtimeCycles)}
            hint={`${m.typeCycles} more exist only through type-only imports`}
          />
          <Stat
            label="Mean imports per file"
            value={m.meanFanOut.toFixed(1)}
            hint="distinct files, resolved imports only"
          />
        </dl>
      </Section>

      <Section
        id="cycles"
        title="Dependency cycles"
        lead={`${m.runtimeCycles} runtime and ${m.typeCycles} type-only. A cycle is a strongly connected component: every module in it can reach every other through imports.`}
      >
        {ins.cycles.length === 0 ? (
          <EmptyNote>
            No cycles were found. Every import chain between source files ends somewhere.
          </EmptyNote>
        ) : (
          <ul className="space-y-5">
            {ins.cycles.map((c) => {
              const edges = c.finding.evidence.flatMap((eid) => edgeById.get(eid) ?? []);
              return (
                <li key={c.id} className="am-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-display text-base font-semibold">{c.title}</h4>
                      <p className="mt-1 text-[14px] text-muted">{c.finding.explanation}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={c.kind === "runtime" ? "warning" : "info"}>{c.kind}</Badge>
                      <Link
                        href={`${base}?cycle=${encodeURIComponent(c.id)}`}
                        className="am-btn am-btn-sm"
                      >
                        Open in graph
                      </Link>
                    </div>
                  </div>
                  <p className="mt-3 break-words font-mono text-[12.5px] leading-relaxed">
                    {c.members.map((n, i) => (
                      <span key={n.id}>
                        {i > 0 && <span className="text-muted"> → </span>}
                        <NodeLink base={base} node={n} />
                      </span>
                    ))}
                  </p>
                  <div className="mt-4">
                    <EvidenceTable
                      edges={edges}
                      nodeById={nodeById}
                      caption={`Imports that form ${c.title}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        id="coupling"
        title="Coupling and hotspots"
        lead="Fan-in is how many distinct files import a file; fan-out is how many it imports. A hotspot is a file whose combined coupling is unusually high for this repository."
      >
        <div className="am-table-wrap">
          <table className="am-table">
            <caption className="sr-only">Most coupled files by fan-in plus fan-out</caption>
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col" className="text-right">
                  Fan-in
                </th>
                <th scope="col" className="text-right">
                  Fan-out
                </th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {ins.coupling.slice(0, TOP).map((r) => (
                <tr key={r.node.id}>
                  <th scope="row">
                    <NodeLink base={base} node={r.node} />
                  </th>
                  <td className="text-right tabular-nums">{r.fanIn}</td>
                  <td className="text-right tabular-nums">{r.fanOut}</td>
                  <td className="min-w-[8rem]">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-right tabular-nums">{r.total}</span>
                      <span
                        aria-hidden="true"
                        className="h-2 rounded-full bg-primary"
                        style={{
                          width: `${Math.max(4, (r.total / maxCoupling) * 100)}%`,
                          maxWidth: "7rem",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ins.coupling.length > TOP && (
          <p className="mt-2 text-[13px] text-muted">
            Showing the top {TOP} of {formatCount(ins.coupling.length)} files.
          </p>
        )}

        <h4 className="mt-7 font-display text-base font-semibold">
          Hotspots ({ins.hotspots.length})
        </h4>
        {ins.hotspots.length === 0 ? (
          <div className="mt-2">
            <EmptyNote>No file crosses the hotspot threshold (rule {RULES.hotspot}).</EmptyNote>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {ins.hotspots.map(({ finding, node }) => (
              <li
                key={finding.id}
                className="am-card flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  {node ? (
                    <NodeLink base={base} node={node} />
                  ) : (
                    <span className="font-mono text-[12.5px]">{finding.nodes[0]}</span>
                  )}
                  <p className="text-[13px] text-muted">{finding.explanation}</p>
                </div>
                <Badge>{finding.rule}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="packages"
        title="Package relationships"
        lead="Cross-package imports, summed from file-level edges (aggregateByPackage). Imports inside one package are not counted."
      >
        {ins.packageEdges.length === 0 ? (
          <EmptyNote>
            No file imports another workspace package, or this repository has a single package.
          </EmptyNote>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="am-table-wrap">
              <table className="am-table">
                <caption className="sr-only">Packages and their relationships</caption>
                <thead>
                  <tr>
                    <th scope="col">Package</th>
                    <th scope="col" className="text-right">
                      Files
                    </th>
                    <th scope="col" className="text-right">
                      Imports
                    </th>
                    <th scope="col" className="text-right">
                      Imported by
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ins.packages.map((p) => (
                    <tr key={p.name}>
                      <th scope="row" className="break-all font-mono text-[12.5px]">
                        {p.name}
                      </th>
                      <td className="text-right tabular-nums">{p.files}</td>
                      <td className="text-right tabular-nums">{p.dependsOn}</td>
                      <td className="text-right tabular-nums">{p.dependedOnBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="am-table-wrap">
              <table className="am-table">
                <caption className="sr-only">Cross-package import counts</caption>
                <thead>
                  <tr>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col" className="text-right">
                      Imports
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ins.packageEdges.map((p) => (
                    <tr key={`${p.source}>${p.target}`}>
                      <td className="break-all font-mono text-[12.5px]">{p.source}</td>
                      <td className="break-all font-mono text-[12.5px]">{p.target}</td>
                      <td className="text-right tabular-nums">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section
        id="unresolved"
        title={`Unresolved imports (${ins.unresolved.length})`}
        lead="The analyzer found these import statements but could not map them to a file or package. They are not drawn in the graph."
      >
        {ins.unresolved.length === 0 ? (
          <EmptyNote>Every import the analyzer found was resolved.</EmptyNote>
        ) : (
          <>
            <EvidenceTable
              edges={ins.unresolved.slice(0, 200)}
              caption="Unresolved import statements"
            />
            {ins.unresolved.length > 200 && (
              <p className="mt-2 text-[13px] text-muted">
                Showing 200 of {formatCount(ins.unresolved.length)}. The JSON export contains all of
                them.
              </p>
            )}
          </>
        )}
      </Section>

      <Section
        id="diagnostics"
        title={`Diagnostics (${ins.diagnostics.length})`}
        lead="Things the analyzer could not handle or chose to skip. They are the reason a result can be marked completed with limitations."
      >
        {ins.diagnostics.length === 0 ? (
          <EmptyNote>The analyzer reported no diagnostics.</EmptyNote>
        ) : (
          <DiagnosticsTable items={ins.diagnostics} />
        )}
      </Section>

      <Section
        id="evidence"
        title="Evidence"
        lead="Every finding keeps the ids of the import statements that support it, so each claim can be checked against the source."
      >
        {graph.findings.length === 0 ? (
          <EmptyNote>There are no findings to support.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {graph.findings.map((f) => {
              const edges = f.evidence.flatMap((eid) => edgeById.get(eid) ?? []);
              return (
                <li key={f.id} className="am-card px-4 py-3">
                  <details>
                    <summary className="flex min-h-9 cursor-pointer flex-wrap items-center gap-2">
                      <Badge tone={f.severity === "warning" ? "warning" : "info"}>
                        {f.category}
                      </Badge>
                      <span className="text-[14px]">{f.explanation}</span>
                      <span className="text-[12px] text-muted">
                        {f.nodes.length} {f.nodes.length === 1 ? "module" : "modules"},{" "}
                        {edges.length} supporting {edges.length === 1 ? "import" : "imports"}
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      <p className="text-[13px] text-muted">
                        Rule <code>{f.rule}</code>. Finding id{" "}
                        <code className="break-all">{f.id}</code>.
                      </p>
                      <ul className="flex flex-wrap gap-x-3 gap-y-1">
                        {f.nodes.slice(0, 40).map((nid) => {
                          const n = nodeById.get(nid);
                          return n ? (
                            <li key={nid}>
                              <NodeLink base={base} node={n} />
                            </li>
                          ) : null;
                        })}
                      </ul>
                      {edges.length > 0 ? (
                        <EvidenceTable
                          edges={edges.slice(0, 50)}
                          nodeById={nodeById}
                          caption={`Evidence for finding ${f.category}`}
                        />
                      ) : (
                        <p className="text-[13px] text-muted">
                          This rule is a threshold on the whole graph rather than on particular
                          statements, so it has no single supporting import. See the inspector for
                          the file&apos;s edges.
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="methodology" title="Methodology and limitations">
        <div className="am-prose max-w-3xl">
          <p>
            These are the rules that produced the findings above, versioned so results stay
            comparable. They are documented in ADR-0004 and implemented in{" "}
            <code>@archmap/graph-core</code>.
          </p>
          <ul>
            <li>
              <strong>Runtime cycle</strong> (<code>{RULES.cycle}</code>, warning): a strongly
              connected component of the graph that uses only runtime imports, with more than one
              module or a module that imports itself. Found with an iterative Tarjan algorithm.
            </li>
            <li>
              <strong>Type-only cycle</strong> (<code>{RULES.cycle}</code>, info): a cycle that
              appears only when type-only imports are included. Type-only imports are erased at
              runtime, so these rarely matter for execution order.
            </li>
            <li>
              <strong>Hotspot</strong> (<code>{RULES.hotspot}</code>, info): a file whose fan-in
              plus fan-out is at least the larger of 8 and ⌈mean + 2 × standard deviation⌉ over all
              files in this analysis.
            </li>
            <li>
              <strong>Unresolved import</strong> (<code>{RULES.unresolved}</code>, warning): an
              import statement whose specifier could not be resolved to a file or package.
            </li>
            <li>
              <strong>Potential change impact</strong> is static reachability: the modules that
              import a module, directly or through others. It does not mean they will break.
            </li>
          </ul>
          <p>Supported constructs in this analysis:</p>
          <ul>
            {graph.coverage.supportedConstructs.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p>
            Not covered: runtime-computed imports (<code>require(expr)</code>,{" "}
            <code>import(expr)</code>), framework conventions, non-JavaScript assets and
            symbol-level relationships. {graph.coverage.unsupportedExpressions} unsupported
            expressions and {graph.coverage.filesWithParseErrors} files with parse errors were
            recorded in this analysis. See{" "}
            <Link href="/docs/analysis-coverage">analysis coverage</Link> for the complete list.
          </p>
        </div>
      </Section>
    </PageFrame>
  );
}
