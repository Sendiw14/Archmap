"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  CircleHelp,
  Info,
  List,
  Loader2,
  Network,
  PanelRightOpen,
  RotateCcw,
  Terminal,
} from "lucide-react";
import type { ArchmapGraph } from "@archmap/graph-schema";
import { parseGraph } from "../../lib/graph/load";
import { DEFAULT_SAMPLE_ID, SAMPLES } from "../../lib/graph/samples";
import {
  computeHighlight,
  cycleItems,
  DEFAULT_FILTERS,
  deriveVisible,
  inspectNode,
  moduleRows,
  mostImportedFile,
  NO_HIGHLIGHT,
  type CycleItem,
  type Focus,
  type ViewFilters,
} from "../../lib/graph/model";
import { buildSearchIndex, searchPaths } from "../../lib/graph/search";
import { buildImpactIndex, impactView } from "../../lib/graph/impact";
import { useMediaQuery } from "../../hooks/use-media-query";
import { CycleList } from "./cycle-list";
import { Drawer } from "./drawer";
import { GraphCanvas } from "./graph-canvas";
import { Inspector } from "./inspector";
import { Legend } from "./legend";
import { ModuleList } from "./module-list";
import { SearchBox } from "./search-box";
import { Tour, type TourAction } from "./tour";

type View = "graph" | "list";
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; graph: ArchmapGraph };

const TOUR_KEY = "archmap.demo.tour-dismissed";

export function DemoWorkspace() {
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE_ID);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [view, setView] = useState<View | null>(null);
  const [filters, setFilters] = useState<ViewFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fitSeq, setFitSeq] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ ids: string[]; seq: number } | null>(null);
  const [status, setStatus] = useState("");
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourFocus, setTourFocus] = useState(false);
  const [autoCycle, setAutoCycle] = useState(false);

  const docked = useMediaQuery("(min-width: 1024px)");
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]!;

  // Responsive default: list view on narrow screens, graph otherwise. Decided once on mount.
  useEffect(() => {
    setView(window.matchMedia("(min-width: 768px)").matches ? "graph" : "list");
    try {
      // auto-open on larger screens only; phones keep the Walkthrough button
      if (localStorage.getItem(TOUR_KEY) !== "1" && window.matchMedia("(min-width: 768px)").matches)
        setTourStep(0);
    } catch {
      /* storage unavailable: skip the auto-open */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoad({ status: "loading" });
    sample
      .load()
      .then((raw) => {
        if (!alive) return;
        const res = parseGraph(raw);
        setLoad(
          res.ok ? { status: "ready", graph: res.graph } : { status: "error", message: res.error },
        );
      })
      .catch((e: unknown) => {
        if (alive)
          setLoad({
            status: "error",
            message: `Could not load the sample: ${e instanceof Error ? e.message : "unknown error"}`,
          });
      });
    return () => {
      alive = false;
    };
  }, [sample, attempt]);

  const graph = load.status === "ready" ? load.graph : null;
  const vg = useMemo(() => (graph ? deriveVisible(graph, filters) : null), [graph, filters]);
  const cycles = useMemo(() => (graph ? cycleItems(graph) : []), [graph]);
  const impactIndex = useMemo(
    () => (graph ? buildImpactIndex(graph, filters) : null),
    [graph, filters],
  );
  const searchIndex = useMemo(() => (vg ? buildSearchIndex(vg.nodes) : null), [vg]);
  const hits = useMemo(
    () => (searchIndex && query.trim() ? searchPaths(searchIndex, query, 500) : []),
    [searchIndex, query],
  );
  const hitMap = useMemo(
    () => (query.trim() ? new Map(hits.map((h) => [h.id, h])) : null),
    [hits, query],
  );
  const matches = useMemo(() => (hitMap ? new Set(hitMap.keys()) : null), [hitMap]);
  const highlight = useMemo(
    () => (vg && graph ? computeHighlight(vg, focus, graph.findings) : NO_HIGHLIGHT),
    [vg, graph, focus],
  );
  const rows = useMemo(() => {
    if (!vg) return [];
    const all = moduleRows(vg);
    return hitMap ? all.filter((r) => hitMap.has(r.id)) : all;
  }, [vg, hitMap]);

  const selectedId = focus?.kind === "node" ? focus.id : null;
  const inspection = useMemo(
    () => (graph && vg && selectedId ? inspectNode(graph, vg, selectedId) : null),
    [graph, vg, selectedId],
  );
  const impact = useMemo(
    () => (vg && impactIndex && selectedId ? impactView(impactIndex, vg, selectedId) : null),
    [vg, impactIndex, selectedId],
  );
  const cycle = focus?.kind === "cycle" ? (cycles.find((c) => c.id === focus.id) ?? null) : null;

  const requestFocus = useCallback(
    (ids: string[]) => setFocusRequest((r) => ({ ids, seq: (r?.seq ?? 0) + 1 })),
    [],
  );

  const selectNode = useCallback(
    (id: string) => {
      setFocus({ kind: "node", id });
      if (!docked) setInspectorOpen(true);
    },
    [docked],
  );

  const selectCycle = useCallback(
    (item: CycleItem) => {
      // a type-only cycle is invisible unless type-only edges are shown
      if (item.usesTypeOnly) setFilters((f) => (f.showTypeOnly ? f : { ...f, showTypeOnly: true }));
      setFocus({ kind: "cycle", id: item.id });
      requestFocus(item.members.map((m) => m.id));
      if (!docked) setInspectorOpen(true);
    },
    [docked, requestFocus],
  );

  const clear = useCallback(() => {
    setFocus(null);
  }, []);

  const resetAll = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setQuery("");
    setFocus(null);
    setInspectorOpen(false);
    setFocusRequest(null);
    setFitSeq((n) => n + 1);
    setStatus("View reset: filters, search and selection cleared.");
  }, []);

  const changeSample = (id: string) => {
    resetAll();
    setSampleId(id);
  };

  const chooseSearchHit = (id: string) => {
    if (!vg || !graph) return;
    selectNode(id);
    requestFocus([...computeHighlight(vg, { kind: "node", id }, graph.findings).nodes.keys()]);
  };

  const toggleFilter = (key: keyof ViewFilters) => {
    const next = { ...filters, [key]: !filters[key] };
    setFilters(next);
    if (key === "showExternals" && !next.showExternals && graph && selectedId) {
      if (graph.nodes.find((n) => n.id === selectedId)?.kind !== "file") setFocus(null);
    }
  };

  const closeTour = () => {
    setTourStep(null);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* storage can be unavailable; the tour simply shows again next visit */
    }
  };

  const runTourAction = (a: TourAction) => {
    if (a === "show-list") setView("list");
    else if (a === "select-example" && vg) {
      const id = mostImportedFile(vg);
      if (id) {
        selectNode(id);
        requestFocus([id]);
      }
    } else if (a === "open-circular") {
      setAutoCycle(true);
      changeSample("circular");
    }
  };

  // After "Open the circular sample" finishes loading, show its cycle.
  useEffect(() => {
    if (autoCycle && graph && sampleId === "circular" && cycles[0]) {
      setAutoCycle(false);
      selectCycle(cycles[0]);
    }
  }, [autoCycle, graph, sampleId, cycles, selectCycle]);

  // Screen-reader announcements for state that is otherwise only visual.
  useEffect(() => {
    if (inspection) {
      setStatus(
        `Selected ${inspection.node.path}. Imports ${inspection.outgoing.length} modules, imported by ${inspection.incoming.length}.`,
      );
    } else if (cycle) {
      setStatus(`${cycle.title} selected: ${cycle.members.map((m) => m.displayName).join(", ")}.`);
    }
  }, [inspection, cycle]);

  const mobileDrawerOpen = !docked && inspectorOpen && (inspection || cycle);
  const hiddenCount = vg ? vg.hidden.externalEdges + vg.hidden.typeOnlyEdges : 0;

  const inspectorEl = (
    <Inspector
      focus={focus}
      inspection={inspection}
      impact={impact}
      cycle={cycle}
      cycles={cycles}
      filters={filters}
      onSelectNode={selectNode}
      onSelectCycle={(id) => {
        const c = cycles.find((x) => x.id === id);
        if (c) selectCycle(c);
      }}
      onClear={() => {
        clear();
        setInspectorOpen(false);
      }}
      onAnnounce={setStatus}
    />
  );

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)]">
      <div className="sr-only-live" role="status" aria-live="polite">
        {status}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-line bg-bg px-4 py-3 sm:px-6">
        <div className="w-full sm:w-auto">
          <label htmlFor="sample" className="am-eyebrow">
            Sample
          </label>
          <select
            id="sample"
            className="am-field mt-1 sm:min-w-[17rem]"
            value={sampleId}
            onChange={(e) => changeSample(e.target.value)}
          >
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div role="group" aria-label="View" className="flex gap-1">
          <button
            type="button"
            className="am-btn"
            aria-pressed={view === "graph"}
            onClick={() => setView("graph")}
          >
            <Network size={16} aria-hidden="true" /> Graph
          </button>
          <button
            type="button"
            className="am-btn"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={16} aria-hidden="true" /> List
          </button>
        </div>
        <button type="button" className="am-btn" onClick={resetAll}>
          <RotateCcw size={16} aria-hidden="true" /> <span className="max-sm:sr-only">Reset</span>
        </button>
        <button
          type="button"
          className="am-btn"
          onClick={() => {
            setTourFocus(true);
            setTourStep(0);
          }}
        >
          <CircleHelp size={16} aria-hidden="true" />{" "}
          <span className="max-sm:sr-only">Walkthrough</span>
        </button>
        {!docked && (inspection || cycle) && !inspectorOpen && (
          <button type="button" className="am-btn" onClick={() => setInspectorOpen(true)}>
            <PanelRightOpen size={16} aria-hidden="true" /> Details
          </button>
        )}
        <Link href="/docs/cli" className="am-btn am-btn-primary max-sm:hidden sm:ml-auto">
          <Terminal size={16} aria-hidden="true" /> Analyze your own repo
        </Link>
      </div>

      {/* data provenance */}
      <div className="border-b border-line bg-surface px-4 py-2 text-[13px] sm:px-6">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="am-chip border-primary-strong bg-primary-soft font-semibold">
            <Info size={13} aria-hidden="true" /> Demonstration data
          </span>
          <span>
            Real ARCHMAP analyzer output for{" "}
            <strong className="font-semibold">{sample.source}</strong>.
            <span className="max-sm:hidden"> {sample.description}</span>
          </span>
        </p>
        <Link
          href="/docs/cli"
          className="mt-1 inline-flex min-h-8 items-center gap-1.5 font-medium text-primary-strong underline underline-offset-2 sm:hidden"
        >
          <Terminal size={14} aria-hidden="true" /> Analyze your own repo
        </Link>
        <details className="mt-1">
          <summary className="inline-flex min-h-8 cursor-pointer items-center gap-1 text-primary-strong underline underline-offset-2">
            How this data was made <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div className="mt-1 space-y-1 text-muted">
            <p>
              Generated by <code>pnpm demo:data</code> and committed as JSON; validated against the
              ArchmapGraph schema when loaded. Command:
            </p>
            <pre className="overflow-x-auto rounded-md border border-line bg-bg px-2 py-1 text-[12px] text-ink">
              <code>archmap analyze {sample.command.replace(/^archmap analyze /, "")}</code>
            </pre>
            {graph && (
              <p>
                Analyzer {graph.metadata.analyzerVersion}, {graph.metadata.compilerVersion}, schema{" "}
                {graph.metadata.schemaVersion}
                {graph.metadata.repository.commit && (
                  <>, repository commit {graph.metadata.repository.commit.slice(0, 7)}</>
                )}
                . {graph.metadata.counts.filesAnalyzed} files analyzed, status{" "}
                {graph.metadata.status}.
              </p>
            )}
          </div>
        </details>
      </div>

      {tourStep !== null && (
        <Tour
          step={tourStep}
          onStep={setTourStep}
          onClose={closeTour}
          onAction={runTourAction}
          focusOnMount={tourFocus}
        />
      )}

      <div className="grid min-h-0 flex-1 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        {/* left panel */}
        <aside
          aria-label="Search, filters and cycles"
          className="border-b border-line bg-bg p-4 md:overflow-y-auto md:border-b-0 md:border-r"
        >
          <SearchBox
            query={query}
            onQueryChange={setQuery}
            hits={hits}
            showResults={view === "graph"}
            onChoose={chooseSearchHit}
          />
          <button
            type="button"
            className="am-btn mt-3 w-full justify-between md:hidden"
            aria-expanded={panelOpen}
            aria-controls="side-extra"
            onClick={() => setPanelOpen((o) => !o)}
          >
            Filters, cycles and legend
            <ChevronDown size={16} aria-hidden="true" className={panelOpen ? "rotate-180" : ""} />
          </button>
          <div
            id="side-extra"
            className={`${panelOpen ? "block" : "hidden"} mt-5 space-y-6 md:block`}
          >
            <fieldset>
              <legend className="am-eyebrow">Filters</legend>
              <label className="mt-1 flex min-h-10 items-center gap-2.5 text-[14px]">
                <input
                  type="checkbox"
                  className="size-5 accent-primary-strong"
                  checked={filters.showExternals}
                  onChange={() => toggleFilter("showExternals")}
                />
                Show external and built-in modules
              </label>
              <label className="flex min-h-10 items-center gap-2.5 text-[14px]">
                <input
                  type="checkbox"
                  className="size-5 accent-primary-strong"
                  checked={filters.showTypeOnly}
                  onChange={() => toggleFilter("showTypeOnly")}
                />
                Show type-only imports
              </label>
            </fieldset>

            {graph && (
              <CycleList items={cycles} activeId={cycle?.id ?? null} onSelect={selectCycle} />
            )}
            {view === "graph" && <Legend unresolvedCount={vg?.unresolved.length ?? 0} />}

            {vg && (
              <details>
                <summary className="am-eyebrow cursor-pointer">
                  Unresolved imports ({vg.unresolved.length})
                </summary>
                {vg.unresolved.length === 0 ? (
                  <p className="mt-2 text-[13px] text-muted">
                    The analyzer resolved every import in this sample.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {vg.unresolved.map((e) => (
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
                  </ul>
                )}
              </details>
            )}
          </div>
        </aside>

        {/* centre */}
        <section
          aria-label={view === "list" ? "Module list" : "Graph"}
          className="flex min-h-0 min-w-0 flex-col bg-surface"
        >
          {vg && (
            <p className="border-b border-line bg-bg px-4 py-2 text-[13px] text-muted">
              {vg.nodes.length} modules, {vg.drawn.length}{" "}
              {vg.drawn.length === 1 ? "dependency" : "dependencies"}
              {vg.unresolved.length > 0 && <>, {vg.unresolved.length} unresolved</>}
              {hiddenCount > 0 && (
                <>
                  . {hiddenCount} {hiddenCount === 1 ? "import is" : "imports are"} hidden by
                  filters
                </>
              )}
              {view === "graph" && (
                <span className="md:hidden">
                  {" "}
                  Pinch to zoom, or{" "}
                  <button
                    type="button"
                    className="font-medium text-primary-strong underline underline-offset-2"
                    onClick={() => setView("list")}
                  >
                    use the list view
                  </button>
                  .
                </span>
              )}
            </p>
          )}
          <div
            className={
              view === "graph"
                ? "relative h-[68dvh] min-h-[380px] lg:h-auto lg:min-h-0 lg:flex-1"
                : "min-h-0 flex-1 bg-bg lg:overflow-y-auto"
            }
          >
            {load.status === "loading" || view === null ? (
              <div
                role="status"
                className="grid h-full min-h-[240px] place-items-center p-6 text-sm text-muted"
              >
                <p className="flex items-center gap-2">
                  <Loader2
                    size={18}
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />{" "}
                  Loading {sample.label}&hellip;
                </p>
              </div>
            ) : load.status === "error" ? (
              <div role="alert" className="grid h-full min-h-[240px] place-items-center p-6">
                <div className="max-w-md rounded-xl border border-danger bg-danger-soft p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-danger">
                    <AlertTriangle size={18} aria-hidden="true" /> This sample could not be loaded
                  </p>
                  <p className="mt-1">{load.message}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="am-btn am-btn-sm"
                      onClick={() => setAttempt((a) => a + 1)}
                    >
                      Try again
                    </button>
                    {sampleId !== DEFAULT_SAMPLE_ID && (
                      <button
                        type="button"
                        className="am-btn am-btn-sm"
                        onClick={() => changeSample(DEFAULT_SAMPLE_ID)}
                      >
                        Open the default sample
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : vg && vg.nodes.length === 0 ? (
              <div className="grid h-full min-h-[240px] place-items-center p-6 text-center text-sm text-muted">
                <div>
                  <p className="font-display text-base font-semibold text-ink">
                    No modules to show
                  </p>
                  <p className="mt-1 max-w-sm">
                    This analysis has no modules
                    {!filters.showExternals && " visible with the current filters"}.
                  </p>
                </div>
              </div>
            ) : view === "graph" && vg ? (
              <GraphCanvas
                vg={vg}
                highlight={highlight}
                matches={matches}
                selectedId={selectedId}
                onSelectNode={selectNode}
                onClear={clear}
                fitSeq={fitSeq}
                focusRequest={focusRequest}
              />
            ) : (
              <ModuleList
                rows={rows}
                hits={hitMap}
                selectedId={selectedId}
                onSelect={selectNode}
                caption={`Modules in ${sample.label} with their import counts`}
              />
            )}
          </div>
        </section>

        {/* docked inspector */}
        {docked && (
          <aside aria-label="Inspector" className="overflow-y-auto border-l border-line bg-bg p-4">
            <h2 className="am-eyebrow mb-3">Inspector</h2>
            {inspectorEl}
          </aside>
        )}
      </div>

      {mobileDrawerOpen && (
        <Drawer label="Inspector" onClose={() => setInspectorOpen(false)}>
          {inspectorEl}
        </Drawer>
      )}
    </div>
  );
}
