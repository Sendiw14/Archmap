"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GraphNode } from "@archmap/graph-schema";
import { DEFAULT_FILTERS, type Direction } from "../../lib/graph/model";
import type { LandingData } from "../../lib/landing/data";
import type { PreviewData } from "../../lib/landing/preview";
import { allBranchIds, buildTree, flattenTree } from "../../lib/workspace/tree";
import { plural } from "../../lib/format";
import { ExplorerTree } from "../workspace/explorer-tree";
import { Inspector } from "../workspace/inspector";
import { GraphPreview } from "./graph-preview";

function degree(data: PreviewData, id: string) {
  return {
    out: data.drawn.filter((e) => e.source === id).length,
    inn: data.drawn.filter((e) => e.target === id).length,
  };
}

const nameOf = (data: PreviewData, id: string) =>
  data.nodes.find((n) => n.id === id)?.displayName ?? id;

/* ------------------------------------------------------------------ hero */

export function HeroPreview({
  data,
}: {
  data: Pick<LandingData, "heroFiles" | "heroPackages" | "featured" | "facts">;
}) {
  const [file, setFile] = useState<string | null>(data.featured);
  const [pkg, setPkg] = useState<string | null>(null);
  const f = file ? degree(data.heroFiles, file) : null;
  return (
    <figure className="m-0">
      <div className="am-card overflow-hidden bg-surface shadow-[0_24px_60px_-28px_rgba(21,27,43,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-bg px-4 py-2.5 text-[13px]">
          <p className="flex flex-wrap items-center gap-x-2">
            <span className="am-chip border-primary-strong bg-primary-soft font-semibold">
              Real analyzer output
            </span>
            <span className="text-muted">
              ARCHMAP analyzing its own source: {plural(data.facts.files, "file")},{" "}
              {plural(data.facts.imports, "import")}
            </span>
          </p>
          <Link
            href="/analyses/demo-archmap"
            className="font-medium text-primary-strong underline underline-offset-2"
          >
            Open this in the workspace
          </Link>
        </div>
        <div className="p-3 sm:p-6">
          <div className="hidden md:block">
            <GraphPreview
              data={data.heroFiles}
              label="Dependency graph of ARCHMAP's own source files. Select a module to highlight its imports and importers."
              selected={file}
              onSelect={setFile}
              entrance
            />
          </div>
          <div className="md:hidden">
            <GraphPreview
              data={data.heroPackages}
              label="Dependency graph of ARCHMAP's packages. Select a package to highlight its relationships."
              selected={pkg}
              onSelect={setPkg}
              entrance
              minWidth={520}
            />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-[14px] text-muted" role="status" aria-live="polite">
        <span className="hidden md:inline">
          {file && f ? (
            <>
              <strong className="font-mono text-[13px] text-ink">
                {nameOf(data.heroFiles, file)}
              </strong>{" "}
              imports {plural(f.out, "module")} and is imported by {plural(f.inn, "module")}. Arrows
              point from importer to imported. Select another module, or the background to clear.
            </>
          ) : (
            <>Select a module to see what it imports and what imports it.</>
          )}
        </span>
        <span className="md:hidden">
          {pkg ? (
            <>
              <strong className="font-mono text-[13px] text-ink">
                {nameOf(data.heroPackages, pkg)}
              </strong>{" "}
              imports {plural(degree(data.heroPackages, pkg).out, "package")} and is imported by{" "}
              {plural(degree(data.heroPackages, pkg).inn, "package")}.
            </>
          ) : (
            <>
              Packages are shown collapsed. Select one. Scroll sideways if the graph is wider than
              the screen.
            </>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------- exploration */

const DIRS: { id: Direction; label: string }[] = [
  { id: "both", label: "Both" },
  { id: "outgoing", label: "Imports" },
  { id: "incoming", label: "Imported by" },
];

export function ExploreShowcase({
  data,
}: {
  data: Pick<LandingData, "heroFiles" | "inspections" | "impacts" | "featured">;
}) {
  const [sel, setSel] = useState<string | null>(data.featured);
  const [dir, setDir] = useState<Direction>("both");
  const ins = sel ? data.inspections[sel] : null;
  const imp = sel ? data.impacts[sel] : null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="am-card overflow-hidden bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-bg px-4 py-2.5">
          <div role="group" aria-label="Highlight direction" className="flex gap-1">
            {DIRS.map((d) => (
              <button
                key={d.id}
                type="button"
                className="am-btn am-btn-sm"
                aria-pressed={dir === d.id}
                onClick={() => setDir(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-muted">Choose which neighbours light up</p>
        </div>
        <div className="p-3 sm:p-5">
          <GraphPreview
            data={data.heroFiles}
            label="Interactive dependency graph. Select a module, then change the highlight direction."
            selected={sel}
            direction={dir}
            onSelect={setSel}
          />
        </div>
      </div>
      <div className="am-card p-5" role="status" aria-live="polite">
        {ins && imp && sel ? (
          <>
            <p className="am-eyebrow">Selected</p>
            <p className="mt-1 break-all font-mono text-[15px] font-semibold">{ins.node.path}</p>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <Stat label="imports" value={ins.outgoing.length} />
              <Stat label="imported by" value={ins.incoming.length} />
              <Stat label="potential impact" value={imp.total} />
            </dl>
            <h3 className="mt-5 text-[13px] font-semibold">Evidence for what it imports</h3>
            {ins.outgoing.length === 0 ? (
              <p className="mt-1 text-[13px] text-muted">
                It imports no other module in this view.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {ins.outgoing.slice(0, 3).map((g) => (
                  <li
                    key={g.peer.id}
                    className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px]"
                  >
                    <p className="break-all font-mono font-semibold">{g.evidence[0]?.location}</p>
                    <p className="break-words font-mono text-muted">{g.evidence[0]?.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              Potential impact counts modules that import this one, directly or through others. It
              is reachability, not a prediction that they will break.
            </p>
          </>
        ) : (
          <p className="text-[14px] text-muted">
            Select a module in the graph to see its imports, importers and the source line behind
            each edge.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-elevated px-2 py-2.5">
      <dd className="font-display text-2xl font-semibold tabular-nums">{value}</dd>
      <dt className="text-[12px] text-muted">{label}</dt>
    </div>
  );
}

/* ------------------------------------------------------- code to graph */

export function StoryShowcase({ data }: { data: Pick<LandingData, "cycle" | "story"> }) {
  const [active, setActive] = useState<number>(0);
  const e = data.story.edges[active];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-6 lg:grid-cols-2">
      <div className="am-card overflow-hidden">
        <p className="border-b border-line bg-surface px-4 py-2.5 text-[13px] text-muted">
          The import statements the analyzer found, exactly as recorded as evidence
        </p>
        <ul className="divide-y divide-line">
          {data.story.edges.map((s, i) => (
            <li key={s.drawnId}>
              <button
                type="button"
                aria-pressed={active === i}
                onClick={() => setActive(i)}
                className={`flex w-full flex-col gap-1 px-4 py-3.5 text-left ${active === i ? "bg-primary-soft" : "hover:bg-elevated"}`}
              >
                <span className="font-mono text-[12.5px] text-muted">
                  {s.file}:{s.line}:{s.column}
                </span>
                <span className="break-words font-mono text-[14px] font-semibold">{s.text}</span>
                <span className="text-[13px] text-muted">
                  becomes the edge{" "}
                  <strong className="font-mono text-ink">{s.source.replace(/^file:/, "")}</strong> →{" "}
                  <strong className="font-mono text-ink">{s.target.replace(/^file:/, "")}</strong>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="am-card flex flex-col overflow-hidden bg-surface">
        <p
          className="border-b border-line bg-bg px-4 py-2.5 text-[13px] text-muted"
          role="status"
          aria-live="polite"
        >
          {e ? (
            <>
              Highlighted: the edge from{" "}
              <span className="font-mono text-ink">{e.source.replace(/^file:/, "")}</span> to{" "}
              <span className="font-mono text-ink">{e.target.replace(/^file:/, "")}</span>
            </>
          ) : (
            "Select a statement"
          )}
        </p>
        <div className="flex flex-1 items-center p-3 sm:p-5">
          <GraphPreview
            data={data.cycle}
            label="Graph of the circular sample with one edge highlighted"
            edgeFocus={e?.drawnId ?? null}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- cycles */

export function CycleShowcase({ data }: { data: Pick<LandingData, "cycle" | "story"> }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="am-card overflow-hidden bg-surface">
        <div className="border-b border-line bg-bg px-4 py-2.5 text-[13px] text-muted">
          Cycle highlighted. Orange nodes and edges close the loop.
        </div>
        <div className="p-3 sm:p-5">
          <GraphPreview
            data={data.cycle}
            label="Graph of the circular sample with its runtime cycle highlighted"
            cycleId={data.story.cycleId}
          />
        </div>
      </div>
      <div className="am-card p-5">
        <p className="am-eyebrow">Finding</p>
        <h3 className="mt-1 font-display text-lg font-semibold">
          Runtime cycle, {data.story.cycleSize} modules
        </h3>
        <p className="mt-1.5 text-[14px] text-muted">{data.story.explanation}</p>
        <p className="mt-2 text-[12.5px] text-muted">
          Rule <code className="font-mono">{data.story.rule}</code>
        </p>
        <h4 className="mt-4 text-[13px] font-semibold">
          Evidence ({data.story.edges.length} imports)
        </h4>
        <ul className="mt-1.5 space-y-1.5">
          {data.story.edges.map((s) => (
            <li
              key={s.drawnId}
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px]"
            >
              <p className="font-mono font-semibold">
                {s.file}:{s.line}:{s.column}
              </p>
              <p className="break-words font-mono text-muted">{s.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- product demo */

export function ProductDemo({ data }: { data: LandingData }) {
  const nodes = useMemo(() => data.heroFiles.nodes as GraphNode[], [data]);
  const tree = useMemo(() => buildTree(nodes, "directory"), [nodes]);
  const [open, setOpen] = useState(() => allBranchIds(tree));
  const [sel, setSel] = useState<string | null>(data.featured);
  const rows = useMemo(() => flattenTree(tree, open), [tree, open]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const cycleIds = useMemo(
    () => new Set(data.cycles.flatMap((c) => c.members.map((m) => m.id))),
    [data],
  );
  const inspection = sel ? (data.inspections[sel] ?? null) : null;
  const impact = sel ? (data.impacts[sel] ?? null) : null;

  return (
    <div className="am-card overflow-hidden shadow-[0_24px_60px_-28px_rgba(21,27,43,0.28)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-bg px-4 py-2.5 text-[13px]">
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="font-display font-semibold">ARCHMAP (this repository)</span>
          <span className="am-chip border-primary-strong bg-primary-soft font-semibold">
            Demonstration data
          </span>
          <span className="text-muted">
            analyzer {data.facts.analyzer}, schema {data.facts.schema}
          </span>
        </p>
        <Link href="/demo" className="font-medium text-primary-strong underline underline-offset-2">
          Open the full demo
        </Link>
      </div>
      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <div className="flex max-h-72 flex-col border-b border-line p-3 lg:max-h-[30rem] lg:border-b-0 lg:border-r">
          <p className="am-eyebrow mb-2">Explorer</p>
          <ExplorerTree
            label="Files in the ARCHMAP sample"
            rows={rows}
            kindOf={(id) => (byId.get(id)?.kind ?? "file") as "file"}
            pathOf={(id) => byId.get(id)?.path ?? id}
            selectedNodeId={sel}
            onToggle={(id) =>
              setOpen((o) => {
                const n = new Set(o);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              })
            }
            onSelectLeaf={setSel}
            cycleNodeIds={cycleIds}
          />
        </div>
        <div className="min-w-0 border-b border-line bg-surface p-3 lg:border-b-0 lg:p-4">
          <GraphPreview
            data={data.heroFiles}
            label="Workspace graph of the ARCHMAP sample"
            selected={sel}
            onSelect={setSel}
          />
        </div>
        <div className="max-h-[30rem] overflow-y-auto border-line p-4 lg:border-l">
          <p className="am-eyebrow mb-3">Inspector</p>
          <Inspector
            focus={sel ? { kind: "node", id: sel } : null}
            inspection={inspection}
            impact={impact}
            cycle={null}
            cycles={data.cycles}
            filters={DEFAULT_FILTERS}
            onSelectNode={setSel}
            onSelectCycle={() => {}}
            onClear={() => setSel(null)}
            filesHref={(id) => `/analyses/demo-archmap/files?node=${encodeURIComponent(id)}`}
            group={null}
          />
        </div>
      </div>
    </div>
  );
}
