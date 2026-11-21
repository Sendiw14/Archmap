"use client";

import { useMemo, useState } from "react";
import { FileJson, FileText, Image as ImageIcon, Printer } from "lucide-react";
import { toMarkdown } from "@archmap/graph-core/report";
import { api } from "../../lib/api/client";
import { computeLayout } from "../../lib/graph/layout";
import { toElkGraph } from "../../lib/graph/layout-input";
import { DEFAULT_FILTERS, deriveVisible, NO_HIGHLIGHT } from "../../lib/graph/model";
import {
  deriveDisplay,
  effectiveGrouping,
  initialExpanded,
  ungroupedDisplay,
  MAX_FILE_LEVEL_NODES,
} from "../../lib/workspace/aggregate";
import { buildTree } from "../../lib/workspace/tree";
import { svgInputFrom, toSafeSvg } from "../../lib/workspace/svg-export";
import { deriveInsights } from "../../lib/workspace/insights";
import { downloadText, safeFileStem } from "../../lib/download";
import { formatCount, formatDateTime } from "../../lib/format";
import { Badge, Spinner } from "../ui/primitives";
import { CopyButton } from "../ui/copy-button";
import { useToast } from "../ui/toast";
import { useReadyAnalysis } from "./provider";
import { DiagnosticsTable, EmptyNote, NodeLink, PageFrame, Section, Stat } from "./parts";

type Busy = null | "json" | "markdown" | "svg";

export function ReportPage() {
  const { id, graph, meta } = useReadyAnalysis();
  const notify = useToast();
  const base = `/analyses/${id}`;
  const [busy, setBusy] = useState<Busy>(null);
  const [mdSource, setMdSource] = useState<"server" | "browser" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const ins = useMemo(() => deriveInsights(graph), [graph]);
  const stem = safeFileStem(meta.id);
  const m = graph.metadata;

  const downloadJson = () => {
    downloadText(
      `archmap-${stem}-graph.json`,
      `${JSON.stringify(graph, null, 2)}\n`,
      "application/json",
    );
    notify("Graph JSON downloaded.");
  };

  /** Hosted analyses ask the server; demo data, or a server that cannot answer, falls back to the same renderer in the browser. */
  const getMarkdown = async (): Promise<{ text: string; source: "server" | "browser" }> => {
    if (meta.source === "hosted") {
      try {
        return { text: await api.getReportMarkdown(id), source: "server" };
      } catch {
        /* offline or API down: the report is a pure function of the graph we already hold */
      }
    }
    return { text: toMarkdown(graph), source: "browser" };
  };

  const downloadMarkdown = async () => {
    setBusy("markdown");
    try {
      const { text, source } = await getMarkdown();
      setMdSource(source);
      downloadText(`archmap-${stem}-report.md`, text, "text/markdown");
      notify(
        source === "server"
          ? "Markdown report downloaded."
          : "Markdown report generated in your browser and downloaded.",
      );
    } finally {
      setBusy(null);
    }
  };

  const showPreview = async () => {
    if (preview !== null) return setPreview(null);
    const { text, source } = await getMarkdown();
    setMdSource(source);
    setPreview(text);
  };

  const downloadSvg = async () => {
    setBusy("svg");
    try {
      const vg = deriveVisible(graph, DEFAULT_FILTERS);
      const fileCount = vg.nodes.filter((n) => n.kind === "file").length;
      const mode = effectiveGrouping("auto", fileCount);
      const grouped = mode !== "none" || vg.nodes.length > MAX_FILE_LEVEL_NODES;
      let display = ungroupedDisplay(vg);
      if (grouped) {
        const tree = buildTree(vg.nodes, mode === "package" ? "package" : "directory");
        display = deriveDisplay(vg, tree, initialExpanded(tree));
      }
      const layout = await computeLayout(toElkGraph(display));
      const svg = toSafeSvg(
        svgInputFrom({
          title: `ARCHMAP dependency graph: ${meta.repoLabel}`,
          description: `${display.nodes.length} drawn items, ${display.drawn.length} dependencies. Arrows point from importer to imported module.`,
          nodes: display.nodes,
          drawn: display.drawn,
          layout,
          highlight: NO_HIGHLIGHT,
          matches: null,
        }),
      );
      downloadText(`archmap-${stem}-graph.svg`, svg, "image/svg+xml");
      notify("SVG downloaded. It contains only drawn shapes and escaped text.");
    } catch {
      notify("Could not generate the SVG. The JSON and Markdown exports are unaffected.", "error");
    } finally {
      setBusy(null);
    }
  };

  const byCategory = (c: string) => graph.findings.filter((f) => f.category === c);

  return (
    <PageFrame>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight">Report</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            A static summary of this analysis: what was analyzed, what was found, what was not
            covered. It is derived only from the graph, so it is reproducible.
          </p>
        </div>
        <button type="button" className="am-btn am-no-print" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> Print or save as PDF
        </button>
      </header>

      <section
        id="exports"
        aria-labelledby="exports-h"
        className="am-no-print scroll-mt-24 border-b border-line pb-9"
      >
        <h3 id="exports-h" className="font-display text-xl font-semibold tracking-tight">
          Exports
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <ExportCard
            icon={<FileJson size={22} aria-hidden="true" />}
            title="Graph (JSON)"
            text={`The complete graph in schema ${m.schemaVersion}: every node, edge, finding and diagnostic. This is what the CLI writes.`}
          >
            <button
              type="button"
              className="am-btn am-btn-primary"
              onClick={downloadJson}
              disabled={busy !== null}
            >
              Download JSON
            </button>
          </ExportCard>
          <ExportCard
            icon={<FileText size={22} aria-hidden="true" />}
            title="Report (Markdown)"
            text={
              meta.source === "hosted"
                ? "The server-rendered report. If the service cannot be reached, the same report is generated in your browser."
                : "Generated in your browser from the graph with the same renderer the CLI uses. No server involved."
            }
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="am-btn am-btn-primary"
                onClick={downloadMarkdown}
                disabled={busy !== null}
              >
                {busy === "markdown" ? <Spinner /> : null} Download Markdown
              </button>
              <button
                type="button"
                className="am-btn"
                onClick={showPreview}
                aria-expanded={preview !== null}
              >
                {preview !== null ? "Hide preview" : "Preview"}
              </button>
            </div>
            {mdSource && (
              <p className="mt-2 text-[12px] text-muted" role="status">
                Source: {mdSource === "server" ? "ARCHMAP service" : "generated in this browser"}.
              </p>
            )}
          </ExportCard>
          <ExportCard
            icon={<ImageIcon size={22} aria-hidden="true" />}
            title="Graph picture (SVG)"
            text="A sanitized SVG of the overview layout (grouped by folder when the graph is large). For a specific selection, use Export SVG on the Graph page."
          >
            <button
              type="button"
              className="am-btn am-btn-primary"
              onClick={downloadSvg}
              disabled={busy !== null}
            >
              {busy === "svg" ? <Spinner /> : null} {busy === "svg" ? "Preparing" : "Download SVG"}
            </button>
          </ExportCard>
        </div>
        {preview !== null && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[13px] text-muted">Markdown preview (raw text)</p>
              <CopyButton
                text={preview}
                label="Copy Markdown"
                announce="Markdown copied to clipboard"
              />
            </div>
            <pre
              className="am-pre max-h-96 whitespace-pre-wrap break-words"
              tabIndex={0}
              aria-label="Markdown report preview"
            >
              <code>{preview}</code>
            </pre>
          </div>
        )}
      </section>

      <div className="pt-9">
        <Section id="identity" title="Identity">
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-[14px]">
            <dt className="text-muted">Repository</dt>
            <dd>
              {meta.repoUrl ? (
                <a
                  className="text-primary-strong underline underline-offset-2"
                  href={meta.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {meta.repoLabel}
                </a>
              ) : (
                meta.repoLabel
              )}
            </dd>
            <dt className="text-muted">Name in graph</dt>
            <dd>{m.repository.name}</dd>
            <dt className="text-muted">Commit</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {m.repository.commit ? (
                <code className="break-all">{m.repository.commit}</code>
              ) : (
                <span>not a git checkout</span>
              )}
              {m.repository.commit && (
                <CopyButton text={m.repository.commit} label="Copy" announce="Commit SHA copied" />
              )}
            </dd>
            {meta.ref && (
              <>
                <dt className="text-muted">Requested ref</dt>
                <dd>
                  <code>{meta.ref}</code>
                </dd>
              </>
            )}
            <dt className="text-muted">Analysis ID</dt>
            <dd>
              <code className="break-all">{m.analysisId}</code>
            </dd>
          </dl>
        </Section>

        <Section id="versions" title="Versions and status">
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-[14px]">
            <dt className="text-muted">Status</dt>
            <dd>
              <Badge
                tone={
                  m.status === "completed"
                    ? "success"
                    : m.status === "failed"
                      ? "danger"
                      : "warning"
                }
              >
                {m.status.replace(/_/g, " ")}
              </Badge>
            </dd>
            <dt className="text-muted">Analyzer</dt>
            <dd>{m.analyzerVersion}</dd>
            <dt className="text-muted">Compiler</dt>
            <dd>{m.compilerVersion}</dd>
            <dt className="text-muted">Graph schema</dt>
            <dd>{m.schemaVersion}</dd>
            <dt className="text-muted">Config hash</dt>
            <dd>
              <code className="break-all">{m.configHash}</code>
            </dd>
            <dt className="text-muted">Generated</dt>
            <dd>
              {m.generatedAt ? formatDateTime(m.generatedAt) : "no timestamp (reproducible mode)"}
            </dd>
          </dl>
        </Section>

        <Section id="scope" title="Scope" lead="What the analyzer looked at, and what it left out.">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Discovered"
              value={formatCount(m.counts.filesDiscovered)}
              hint="candidate source files"
            />
            <Stat label="Analyzed" value={formatCount(m.counts.filesAnalyzed)} />
            <Stat
              label="Excluded"
              value={formatCount(m.counts.filesExcluded)}
              hint="by ignore rules and --exclude"
            />
            <Stat
              label="Skipped"
              value={formatCount(m.counts.filesSkipped)}
              hint="too large, unreadable or symlinks"
            />
          </dl>
          <p className="mt-3 text-[14px] text-muted">
            The graph has {formatCount(ins.metrics.files)} file nodes,{" "}
            {formatCount(ins.metrics.externals)} external packages and {ins.metrics.builtins}{" "}
            Node.js built-ins.
          </p>
        </Section>

        <Section id="summary" title="Summary">
          <ul className="list-disc space-y-1.5 pl-5 text-[15px]">
            <li>
              {formatCount(ins.metrics.edges)} import statements:{" "}
              {formatCount(ins.metrics.resolved)} resolved to files,{" "}
              {formatCount(ins.metrics.external)} to external or built-in modules,{" "}
              {formatCount(ins.metrics.unresolved)} unresolved.
            </li>
            <li>
              {ins.metrics.runtimeCycles} runtime{" "}
              {ins.metrics.runtimeCycles === 1 ? "cycle" : "cycles"} and {ins.metrics.typeCycles}{" "}
              cycles that exist only through type-only imports.
            </li>
            <li>
              {ins.metrics.hotspots} coupling {ins.metrics.hotspots === 1 ? "hotspot" : "hotspots"}.
            </li>
            <li>
              {ins.metrics.diagnostics}{" "}
              {ins.metrics.diagnostics === 1 ? "diagnostic" : "diagnostics"} from the analyzer.
            </li>
          </ul>
        </Section>

        <Section id="findings" title={`Findings (${graph.findings.length})`}>
          {graph.findings.length === 0 ? (
            <EmptyNote>The analyzer reported no findings.</EmptyNote>
          ) : (
            <div className="am-table-wrap">
              <table className="am-table">
                <caption className="sr-only">Findings by category</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Rule</th>
                    <th scope="col" className="text-right">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(["runtime-cycle", "type-cycle", "hotspot", "unresolved"] as const).map((c) => (
                    <tr key={c}>
                      <th scope="row">{c}</th>
                      <td className="font-mono text-[12.5px]">
                        {byCategory(c)[0]?.rule ?? "not triggered"}
                      </td>
                      <td className="text-right tabular-nums">{byCategory(c).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section id="cycles" title="Cycles">
          {ins.cycles.length === 0 ? (
            <EmptyNote>No cycles were found.</EmptyNote>
          ) : (
            <ol className="space-y-3">
              {ins.cycles.map((c) => (
                <li key={c.id} className="am-card p-4">
                  <p className="font-display text-[15px] font-semibold">
                    {c.title}{" "}
                    <Badge tone={c.kind === "runtime" ? "warning" : "info"}>{c.kind}</Badge>
                  </p>
                  <p className="mt-2 break-words font-mono text-[12.5px] leading-relaxed">
                    {c.members.map((n, i) => (
                      <span key={n.id}>
                        {i > 0 && <span className="text-muted"> → </span>}
                        <NodeLink base={base} node={n} />
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section id="diagnostics" title={`Diagnostics (${graph.diagnostics.length})`}>
          {graph.diagnostics.length === 0 ? (
            <EmptyNote>The analyzer reported no diagnostics.</EmptyNote>
          ) : (
            <DiagnosticsTable items={graph.diagnostics} />
          )}
        </Section>

        <Section id="limitations" title="Limitations">
          <ul className="max-w-3xl list-disc space-y-1.5 pl-5 text-[15px]">
            <li>
              Static analysis of source-level module references only. Runtime-computed imports,
              plugins and framework conventions are not inferred.
            </li>
            <li>
              &quot;Potential change impact&quot; means static reachability, not a guarantee that
              dependents will break.
            </li>
            <li>
              Type-only edges are erased at runtime and are reported separately from runtime
              dependencies.
            </li>
            <li>
              Module-level only: symbols, named exports and which identifiers are imported are not
              extracted.
            </li>
            <li>
              Supported constructs in this analysis: {graph.coverage.supportedConstructs.join("; ")}
              .
            </li>
          </ul>
        </Section>
      </div>
    </PageFrame>
  );
}

function ExportCard({
  icon,
  title,
  text,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="am-card flex flex-col p-5">
      <div className="text-primary-strong">{icon}</div>
      <h4 className="mt-3 font-display text-base font-semibold">{title}</h4>
      <p className="mt-1 flex-1 text-[14px] leading-relaxed text-muted">{text}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
