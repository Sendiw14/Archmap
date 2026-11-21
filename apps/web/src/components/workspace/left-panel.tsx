"use client";

import { useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import type { CycleItem, Direction, ViewFilters } from "../../lib/graph/model";
import type { GroupingMode } from "../../lib/workspace/aggregate";
import type { LayoutDirection } from "../../lib/graph/layout-input";
import type { SearchHit } from "../../lib/graph/search";
import type { TreeRow } from "../../lib/workspace/tree";
import type { GraphEdge } from "@archmap/graph-schema";
import { Tabs, tabPanelProps } from "../ui/tabs";
import { CycleList } from "./cycle-list";
import { ExplorerTree } from "./explorer-tree";
import { Legend } from "./legend";
import { SearchBox } from "./search-box";

type TabId = "explorer" | "view" | "cycles";

export interface LeftPanelProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (q: string) => void;
  hits: SearchHit[];
  showSearchResults: boolean;
  onChooseHit: (id: string) => void;

  rows: TreeRow[];
  kindOf: (id: string) => "file" | "external" | "builtin";
  pathOf: (id: string) => string;
  selectedNodeId: string | null;
  onToggleTree: (id: string) => void;
  onSelectLeaf: (id: string) => void;
  onExpandTree: () => void;
  onCollapseTree: () => void;
  cycleNodeIds: ReadonlySet<string>;

  filters: ViewFilters;
  onToggleFilter: (key: keyof ViewFilters) => void;
  direction: Direction;
  onDirection: (d: Direction) => void;
  grouping: GroupingMode;
  onGrouping: (g: GroupingMode) => void;
  /** Whether file-level drawing is allowed for this many modules. */
  fileLevelAllowed: boolean;
  groupingSummary: string;
  layoutDirection: LayoutDirection;
  onLayoutDirection: (d: LayoutDirection) => void;

  cycles: CycleItem[];
  activeCycleId: string | null;
  onSelectCycle: (c: CycleItem) => void;
  unresolved: GraphEdge[];
  /** Phones show only the search box until the sections are opened. */
  sectionsHidden?: boolean;
  afterSearch?: React.ReactNode;
}

const DIRECTIONS: { id: Direction; label: string; hint: string }[] = [
  { id: "both", label: "Both", hint: "Highlight what the selection imports and what imports it" },
  {
    id: "outgoing",
    label: "Imports",
    hint: "Highlight only modules the selection imports (outgoing)",
  },
  {
    id: "incoming",
    label: "Imported by",
    hint: "Highlight only modules that import the selection (incoming)",
  },
];

export function LeftPanel(p: LeftPanelProps) {
  const [tab, setTab] = useState<TabId>("explorer");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <SearchBox
        inputRef={p.searchInputRef}
        query={p.query}
        onQueryChange={p.onQueryChange}
        hits={p.hits}
        showResults={p.showSearchResults}
        onChoose={p.onChooseHit}
      />
      {p.afterSearch}
      {!p.sectionsHidden && (
        <>
          <Tabs
            idPrefix="lp"
            label="Panel sections"
            active={tab}
            onChange={(id) => setTab(id as TabId)}
            tabs={[
              { id: "explorer", label: "Explorer" },
              { id: "view", label: "View" },
              { id: "cycles", label: `Cycles (${p.cycles.length})` },
            ]}
          />
          <div {...tabPanelProps("lp", tab)} className="flex min-h-0 flex-1 flex-col">
            {tab === "explorer" && (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[12px] text-muted">
                    {p.grouping === "package" ? "By package" : "By folder"}
                    {p.query.trim() ? ", matches only" : ""}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="am-btn am-btn-quiet am-btn-sm"
                      onClick={p.onExpandTree}
                      aria-label="Expand all folders"
                    >
                      <ChevronsUpDown size={14} aria-hidden="true" /> Expand
                    </button>
                    <button
                      type="button"
                      className="am-btn am-btn-quiet am-btn-sm"
                      onClick={p.onCollapseTree}
                      aria-label="Collapse all folders"
                    >
                      <ChevronsDownUp size={14} aria-hidden="true" /> Collapse
                    </button>
                  </div>
                </div>
                <ExplorerTree
                  label="Files and packages"
                  rows={p.rows}
                  kindOf={p.kindOf}
                  pathOf={p.pathOf}
                  selectedNodeId={p.selectedNodeId}
                  onToggle={p.onToggleTree}
                  onSelectLeaf={p.onSelectLeaf}
                  cycleNodeIds={p.cycleNodeIds}
                />
              </>
            )}

            {tab === "view" && (
              <div className="space-y-6 overflow-y-auto pb-4">
                <fieldset>
                  <legend className="am-eyebrow">Highlight direction</legend>
                  <div role="group" aria-label="Highlight direction" className="mt-1.5 flex gap-1">
                    {DIRECTIONS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className="am-btn am-btn-sm flex-1"
                        aria-pressed={p.direction === d.id}
                        title={d.hint}
                        onClick={() => p.onDirection(d.id)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted">
                    {DIRECTIONS.find((d) => d.id === p.direction)!.hint}.
                  </p>
                </fieldset>

                <fieldset>
                  <legend className="am-eyebrow">Filters</legend>
                  <label className="mt-1 flex min-h-10 items-center gap-2.5 text-[14px]">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary-strong"
                      checked={p.filters.showExternals}
                      onChange={() => p.onToggleFilter("showExternals")}
                    />
                    External and built-in modules
                  </label>
                  <label className="flex min-h-10 items-center gap-2.5 text-[14px]">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary-strong"
                      checked={p.filters.showTypeOnly}
                      onChange={() => p.onToggleFilter("showTypeOnly")}
                    />
                    Type-only imports
                  </label>
                </fieldset>

                <div>
                  <label htmlFor="grouping" className="am-eyebrow">
                    Grouping
                  </label>
                  <select
                    id="grouping"
                    className="am-field mt-1.5"
                    value={p.grouping}
                    onChange={(e) => p.onGrouping(e.target.value as GroupingMode)}
                  >
                    <option value="auto">Automatic</option>
                    <option value="none" disabled={!p.fileLevelAllowed}>
                      Individual files{p.fileLevelAllowed ? "" : " (too many to draw)"}
                    </option>
                    <option value="directory">Folders</option>
                    <option value="package">Packages</option>
                  </select>
                  <p className="mt-1.5 text-[12px] text-muted">{p.groupingSummary}</p>
                </div>

                <div>
                  <label htmlFor="layout-dir" className="am-eyebrow">
                    Layout
                  </label>
                  <select
                    id="layout-dir"
                    className="am-field mt-1.5"
                    value={p.layoutDirection}
                    onChange={(e) => p.onLayoutDirection(e.target.value as LayoutDirection)}
                  >
                    <option value="RIGHT">Left to right (importers on the left)</option>
                    <option value="DOWN">Top to bottom (importers on top)</option>
                  </select>
                </div>

                <Legend unresolvedCount={p.unresolved.length} />
              </div>
            )}

            {tab === "cycles" && (
              <div className="space-y-6 overflow-y-auto pb-4">
                <CycleList items={p.cycles} activeId={p.activeCycleId} onSelect={p.onSelectCycle} />
                <section aria-labelledby="unres-h">
                  <h3 id="unres-h" className="am-eyebrow">
                    Unresolved imports ({p.unresolved.length})
                  </h3>
                  {p.unresolved.length === 0 ? (
                    <p className="mt-2 text-[13px] text-muted">
                      The analyzer resolved every import it found.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {p.unresolved.slice(0, 100).map((e) => (
                        <li
                          key={e.id}
                          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px]"
                        >
                          <p className="break-all font-mono font-semibold">
                            {e.evidence.file}:{e.evidence.line}:{e.evidence.column}
                          </p>
                          <p className="break-words font-mono text-muted">
                            <code>{e.evidence.text}</code>
                          </p>
                        </li>
                      ))}
                      {p.unresolved.length > 100 && (
                        <li className="text-[12px] text-muted">
                          {p.unresolved.length - 100} more on the Insights page.
                        </li>
                      )}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
