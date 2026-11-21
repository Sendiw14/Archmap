"use client";

import { useState } from "react";
import { Box, Check, Copy, Cpu, FileCode2, RefreshCcw } from "lucide-react";
import type { GraphNode } from "@archmap/graph-schema";
import type {
  CycleItem,
  EvidenceRow,
  Focus,
  NodeInspection,
  PeerGroup,
  ViewFilters,
} from "../../lib/graph/model";
import {
  IMPACT_DISCLAIMER,
  IMPACT_TITLE,
  type ImpactRow,
  type ImpactView,
} from "../../lib/graph/impact";

const KIND_ICON = { file: FileCode2, external: Box, builtin: Cpu } as const;
const KIND_LABEL = {
  file: "File",
  external: "External package",
  builtin: "Node.js built-in",
} as const;

export interface InspectorProps {
  focus: Focus | null;
  inspection: NodeInspection | null;
  impact: ImpactView | null;
  cycle: CycleItem | null;
  cycles: CycleItem[];
  filters: ViewFilters;
  onSelectNode: (id: string) => void;
  onSelectCycle: (findingId: string) => void;
  onClear: () => void;
  onAnnounce: (msg: string) => void;
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="font-display text-[14px] font-semibold">
      {children}
    </h3>
  );
}

function ClassChip({ cls }: { cls: "runtime" | "type-only" }) {
  return (
    <span className={`am-chip ${cls === "type-only" ? "border-dashed" : ""}`}>
      {cls === "type-only" ? "type-only" : "runtime"}
    </span>
  );
}

function Evidence({ rows }: { rows: EvidenceRow[] }) {
  return (
    <ul className="mt-1.5 space-y-1.5">
      {rows.map((ev) => (
        <li key={ev.id} className="rounded-md border border-line bg-surface px-2.5 py-1.5">
          <p className="break-all font-mono text-[12px] font-semibold text-ink">{ev.location}</p>
          <p className="mt-0.5 break-words font-mono text-[12px] leading-snug text-muted">
            <code>{ev.text}</code>
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {ev.importKind} <ClassChip cls={ev.dependencyClass} />
          </p>
        </li>
      ))}
    </ul>
  );
}

function PeerList({
  groups,
  empty,
  labelledBy,
  onSelect,
}: {
  groups: PeerGroup[];
  empty: string;
  labelledBy: string;
  onSelect: (id: string) => void;
}) {
  if (groups.length === 0) return <p className="mt-1.5 text-[13px] text-muted">{empty}</p>;
  return (
    <ul aria-labelledby={labelledBy} className="mt-1.5 space-y-3">
      {groups.map((g) => (
        <li key={g.peer.id}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              className="break-all rounded-md text-left font-mono text-[12.5px] font-semibold text-primary-strong underline underline-offset-2"
              onClick={() => onSelect(g.peer.id)}
              aria-label={`Select ${g.peer.path}`}
            >
              {g.peer.path}
            </button>
            {g.classes.map((c) => (
              <ClassChip key={c} cls={c} />
            ))}
          </div>
          <Evidence rows={g.evidence} />
        </li>
      ))}
    </ul>
  );
}

function CopyButton({ text, onAnnounce }: { text: string; onAnnounce: (m: string) => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="am-btn am-btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          onAnnounce("Path copied to clipboard");
          setTimeout(() => setDone(false), 1500);
        } catch {
          onAnnounce("Copy is not available in this browser");
        }
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {done ? "Copied" : "Copy path"}
    </button>
  );
}

const IMPACT_LIMIT = 20;

function ImpactList({
  rows,
  onSelect,
  showChain,
}: {
  rows: ImpactRow[];
  onSelect: (id: string) => void;
  showChain: boolean;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, IMPACT_LIMIT);
  return (
    <>
      <ul className="mt-1.5 space-y-1.5">
        {shown.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className="break-all rounded-md text-left font-mono text-[12.5px] font-semibold text-primary-strong underline underline-offset-2"
              onClick={() => onSelect(r.id)}
              aria-label={`Select ${r.path}`}
            >
              {r.path}
            </button>
            {showChain && (
              <p className="break-words font-mono text-[12px] text-muted">
                <span className="font-sans">Path: </span>
                {r.chain.join(" → ")}
              </p>
            )}
          </li>
        ))}
      </ul>
      {rows.length > IMPACT_LIMIT && !all && (
        <button type="button" className="am-btn am-btn-sm mt-2" onClick={() => setAll(true)}>
          Show all {rows.length}
        </button>
      )}
    </>
  );
}

function NodeFacts({ node }: { node: GraphNode }) {
  const rows: [string, string][] = [
    ["Path", node.path],
    ["Kind", KIND_LABEL[node.kind]],
    ["Language", node.language ?? "not applicable"],
    ["Package", node.package ?? "none"],
  ];
  return (
    <dl className="mt-3 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className={`min-w-0 break-all ${k === "Path" ? "font-mono text-[12.5px]" : ""}`}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Inspector(p: InspectorProps) {
  if (p.focus?.kind === "cycle" && p.cycle) return <CycleDetail {...p} cycle={p.cycle} />;
  if (p.focus?.kind === "node" && p.inspection)
    return <NodeDetail {...p} inspection={p.inspection} />;
  return (
    <div className="text-[14px] text-muted">
      <p>
        Select a module in the graph or in the list to see its path, what it imports, what imports
        it, the source line behind every edge, related findings and its {IMPACT_TITLE.toLowerCase()}
        .
      </p>
      <p className="mt-3">
        Everything here is available by keyboard: Tab to a module and press Enter or Space.
      </p>
    </div>
  );
}

function NodeDetail({
  inspection,
  impact,
  filters,
  onSelectNode,
  onSelectCycle,
  onAnnounce,
  onClear,
  cycles,
}: InspectorProps & { inspection: NodeInspection }) {
  const { node } = inspection;
  const Icon = KIND_ICON[node.kind];
  const hidden = inspection.hidden.externalEdges + inspection.hidden.typeOnlyEdges;
  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start gap-2">
          <Icon size={20} aria-hidden="true" className="mt-0.5 flex-none text-muted" />
          <h3
            className="min-w-0 break-all font-mono text-[15px] font-semibold"
            data-inspector-title
            tabIndex={-1}
          >
            {node.displayName}
          </h3>
        </div>
        <NodeFacts node={node} />
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={node.path} onAnnounce={onAnnounce} />
          <button type="button" className="am-btn am-btn-sm" onClick={onClear}>
            Clear selection
          </button>
        </div>
      </header>

      {hidden > 0 && (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-ink" role="note">
          {inspection.hidden.externalEdges > 0 &&
            `${inspection.hidden.externalEdges} import(s) of external or built-in modules are hidden by the filter. `}
          {inspection.hidden.typeOnlyEdges > 0 &&
            `${inspection.hidden.typeOnlyEdges} type-only import(s) are hidden by the filter.`}
        </p>
      )}

      <section aria-labelledby="insp-out">
        <SectionHeading id="insp-out">Imports ({inspection.outgoing.length})</SectionHeading>
        <PeerList
          groups={inspection.outgoing}
          empty="This module imports nothing in the analysis."
          labelledBy="insp-out"
          onSelect={onSelectNode}
        />
      </section>

      <section aria-labelledby="insp-in">
        <SectionHeading id="insp-in">Imported by ({inspection.incoming.length})</SectionHeading>
        <PeerList
          groups={inspection.incoming}
          empty="No module in this analysis imports it."
          labelledBy="insp-in"
          onSelect={onSelectNode}
        />
      </section>

      {inspection.unresolved.length > 0 && (
        <section aria-labelledby="insp-unres">
          <SectionHeading id="insp-unres">
            Unresolved imports ({inspection.unresolved.length})
          </SectionHeading>
          <p className="mt-1 text-[13px] text-muted">
            The analyzer could not resolve these. They are not drawn in the graph.
          </p>
          <Evidence rows={inspection.unresolved} />
        </section>
      )}

      <section aria-labelledby="insp-find">
        <SectionHeading id="insp-find">Findings ({inspection.findings.length})</SectionHeading>
        {inspection.findings.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-muted">No findings involve this module.</p>
        ) : (
          <ul className="mt-1.5 space-y-2">
            {inspection.findings.map((f) => {
              const isCycle = cycles.some((c) => c.id === f.id);
              return (
                <li
                  key={f.id}
                  className="rounded-md border border-line bg-surface px-2.5 py-2 text-[13px]"
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="am-chip">{f.category}</span>
                    <span className="am-chip">{f.severity}</span>
                  </p>
                  <p className="mt-1">{f.explanation}</p>
                  {isCycle && (
                    <button
                      type="button"
                      className="am-btn am-btn-sm mt-2"
                      onClick={() => onSelectCycle(f.id)}
                    >
                      <RefreshCcw size={14} aria-hidden="true" /> Highlight this cycle
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {impact && (
        <section
          aria-labelledby="insp-impact"
          className="rounded-xl border border-line bg-elevated p-3"
        >
          <SectionHeading id="insp-impact">{IMPACT_TITLE}</SectionHeading>
          <p className="mt-1 text-[13px] text-muted">{IMPACT_DISCLAIMER}</p>
          {!filters.showTypeOnly && (
            <p className="mt-1 text-[13px] text-muted">
              Type-only imports are hidden, so they are not counted here.
            </p>
          )}
          {impact.total === 0 ? (
            <p className="mt-2 text-[13px]">No other module in this analysis imports this one.</p>
          ) : (
            <>
              <p className="mt-2 text-[13px] font-medium" role="status">
                {impact.direct.length} direct and {impact.indirect.length} indirect dependent
                {impact.total === 1 ? "" : "s"}
                {impact.packages.length > 0 && (
                  <>
                    {" "}
                    across {impact.packages.length} package{impact.packages.length === 1 ? "" : "s"}
                    : {impact.packages.join(", ")}
                  </>
                )}
              </p>
              {impact.direct.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-[13px] font-semibold">
                    Direct dependents ({impact.direct.length})
                  </h4>
                  <ImpactList rows={impact.direct} onSelect={onSelectNode} showChain={false} />
                </div>
              )}
              {impact.indirect.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-[13px] font-semibold">
                    Transitive dependents ({impact.indirect.length})
                  </h4>
                  <ImpactList rows={impact.indirect} onSelect={onSelectNode} showChain />
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function CycleDetail({ cycle, onSelectNode, onClear }: InspectorProps & { cycle: CycleItem }) {
  return (
    <div className="space-y-5">
      <header>
        <h3
          className="flex items-start gap-2 font-display text-[15px] font-semibold"
          data-inspector-title
          tabIndex={-1}
        >
          <RefreshCcw size={18} aria-hidden="true" className="mt-0.5 flex-none text-cycle" />
          {cycle.title}
        </h3>
        <p className="mt-2 text-[13px]">{cycle.finding.explanation}</p>
        <p className="mt-1 text-[12px] text-muted">
          Rule <code>{cycle.finding.rule}</code> &middot; severity {cycle.finding.severity}
        </p>
        <button type="button" className="am-btn am-btn-sm mt-3" onClick={onClear}>
          Clear selection
        </button>
      </header>
      <section aria-labelledby="cyc-members">
        <SectionHeading id="cyc-members">Members ({cycle.members.length})</SectionHeading>
        <ul className="mt-1.5 space-y-1">
          {cycle.members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="break-all rounded-md text-left font-mono text-[12.5px] font-semibold text-primary-strong underline underline-offset-2"
                onClick={() => onSelectNode(m.id)}
                aria-label={`Select ${m.path}`}
              >
                {m.path}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="cyc-evidence">
        <SectionHeading id="cyc-evidence">Evidence ({cycle.evidence.length})</SectionHeading>
        <ul className="mt-1.5 space-y-1.5">
          {cycle.evidence.map((ev) => (
            <li key={ev.id} className="rounded-md border border-line bg-surface px-2.5 py-1.5">
              <p className="break-all font-mono text-[12px]">
                {ev.sourcePath} <span aria-label="imports">&rarr;</span> {ev.targetPath}
              </p>
              <p className="mt-0.5 break-all font-mono text-[12px] font-semibold">{ev.location}</p>
              <p className="mt-0.5 break-words font-mono text-[12px] text-muted">
                <code>{ev.text}</code>
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                {ev.importKind} <ClassChip cls={ev.dependencyClass} />
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
