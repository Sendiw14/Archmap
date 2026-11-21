"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CircleHelp,
  ChevronDown,
  FileImage,
  Info,
  List,
  Maximize,
  Minimize,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  ScanSearch,
  Terminal,
} from "lucide-react";
import type { ArchmapGraph } from "@archmap/graph-schema";
import type { AnalysisMeta } from "../../lib/analysis-source";
import type { DemoSample } from "../../lib/graph/samples";
import {
  computeHighlight,
  cycleItems,
  DEFAULT_FILTERS,
  deriveVisible,
  inspectNode,
  moduleRows,
  mostImportedFile,
  type CycleItem,
  type Direction,
  type Focus,
  type ViewFilters,
} from "../../lib/graph/model";
import type { LayoutDirection } from "../../lib/graph/layout-input";
import { buildSearchIndex, searchPaths } from "../../lib/graph/search";
import { buildImpactIndex, impactView } from "../../lib/graph/impact";
import {
  collapseAround,
  deriveDisplay,
  effectiveGrouping,
  expandAll,
  expandTo,
  initialExpanded,
  isLarge,
  MAX_FILE_LEVEL_NODES,
  ungroupedDisplay,
  type GroupingMode,
} from "../../lib/workspace/aggregate";
import {
  allBranchIds,
  ancestorMap,
  buildTree,
  findTreeNode,
  flattenTree,
} from "../../lib/workspace/tree";
import { downloadText, safeFileStem } from "../../lib/download";
import { formatCount, plural } from "../../lib/format";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useToast } from "../ui/toast";
import { Drawer } from "./drawer";
import { GraphCanvas } from "./graph-canvas";
import { HelpDialog } from "../analysis/help-dialog";
import { Inspector } from "./inspector";
import { LeftPanel } from "./left-panel";
import { ModuleList } from "./module-list";
import { Splitter } from "./splitter";
import { Tour, type TourAction } from "./tour";

type View = "graph" | "list";

export interface WorkspaceDemo {
  samples: DemoSample[];
  sampleId: string;
  onSampleChange: (id: string, opts?: { openCycle?: boolean }) => void;
  /** When false the walkthrough never opens by itself (E2E, repeat visits). */
  autoTour?: boolean;
}

export interface WorkspaceProps {
  graph: ArchmapGraph;
  meta: AnalysisMeta;
  /** Present only on /demo: sample picker, walkthrough, provenance banner. */
  demo?: WorkspaceDemo;
  /** `/analyses/<id>`: used for links to Files and Report. */
  basePath: string;
  initialNode?: string | null;
  initialCycle?: string | null;
}

const TOUR_KEY = "archmap.demo.tour-dismissed";
const LEFT_MIN = 240;
const LEFT_MAX = 480;

const idleToolbarBtn = "am-btn";

export function Workspace({
  graph,
  meta,
  demo,
  basePath,
  initialNode,
  initialCycle,
}: WorkspaceProps) {
  const notify = useToast();
  const wide = useMediaQuery("(min-width: 768px)");
  const docked = useMediaQuery("(min-width: 1024px)");

  const [view, setView] = useState<View | null>(null);
  const [filters, setFilters] = useState<ViewFilters>(DEFAULT_FILTERS);
  const [direction, setDirection] = useState<Direction>("both");
  const [grouping, setGrouping] = useState<GroupingMode>("auto");
  const [layoutDir, setLayoutDir] = useState<LayoutDirection>("RIGHT");
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [expandedState, setExpandedState] = useState<{ key: string; set: Set<string> } | null>(
    null,
  );
  const [treeState, setTreeState] = useState<{ key: string; set: Set<string> } | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobileSections, setMobileSections] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(300);
  const [helpOpen, setHelpOpen] = useState(false);
  const [fitSeq, setFitSeq] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ ids: string[]; seq: number } | null>(null);
  const [status, setStatus] = useState("");
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourFocus, setTourFocus] = useState(false);

  const searchInput = useRef<HTMLInputElement>(null);
  const exportRef = useRef<(() => string) | null>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);

  // ------------------------------------------------------------------ derived data
  const vg = useMemo(() => deriveVisible(graph, filters), [graph, filters]);
  const cycles = useMemo(() => cycleItems(graph), [graph]);
  const cycleNodeIds = useMemo(
    () => new Set(cycles.flatMap((c) => c.members.map((m) => m.id))),
    [cycles],
  );
  const impactIndex = useMemo(() => buildImpactIndex(graph, filters), [graph, filters]);

  const fileCount = useMemo(() => vg.nodes.filter((n) => n.kind === "file").length, [vg]);
  const requested = effectiveGrouping(grouping, fileCount);
  const fileLevelAllowed = vg.nodes.length <= MAX_FILE_LEVEL_NODES;
  const effGroup = requested === "none" && !fileLevelAllowed ? "directory" : requested;
  const treeGroupBy = effGroup === "package" ? "package" : "directory";

  const tree = useMemo(() => buildTree(vg.nodes, treeGroupBy), [vg.nodes, treeGroupBy]);
  const ancestors = useMemo(() => ancestorMap(tree), [tree]);
  const stateKey = `${effGroup}|${graph.metadata.analysisId}`;
  const defaultExpanded = useMemo(
    () => (effGroup === "none" ? new Set<string>() : initialExpanded(tree)),
    [tree, effGroup],
  );
  const expanded = expandedState?.key === stateKey ? expandedState.set : defaultExpanded;
  const setExpanded = useCallback(
    (set: Set<string>) => setExpandedState({ key: stateKey, set }),
    [stateKey],
  );

  const display = useMemo(
    () => (effGroup === "none" ? ungroupedDisplay(vg) : deriveDisplay(vg, tree, expanded)),
    [vg, tree, expanded, effGroup],
  );

  const treeKey = `${treeGroupBy}|${graph.metadata.analysisId}`;
  const defaultTreeOpen = useMemo(
    () =>
      tree.count <= 120
        ? allBranchIds(tree)
        : new Set(tree.children.filter((c) => c.nodeId === undefined).map((c) => c.id)),
    [tree],
  );
  const treeOpen = treeState?.key === treeKey ? treeState.set : defaultTreeOpen;
  const setTreeOpen = useCallback(
    (set: Set<string>) => setTreeState({ key: treeKey, set }),
    [treeKey],
  );

  const searchIndex = useMemo(() => buildSearchIndex(vg.nodes), [vg]);
  const hits = useMemo(
    () => (query.trim() ? searchPaths(searchIndex, query, 500) : []),
    [searchIndex, query],
  );
  const hitMap = useMemo(
    () => (query.trim() ? new Map(hits.map((h) => [h.id, h])) : null),
    [hits, query],
  );
  const matchIds = useMemo(() => (hitMap ? new Set(hitMap.keys()) : null), [hitMap]);

  const treeRows = useMemo(() => flattenTree(tree, treeOpen, matchIds), [tree, treeOpen, matchIds]);
  const rows = useMemo(() => {
    const all = moduleRows(vg);
    return hitMap ? all.filter((r) => hitMap.has(r.id)) : all;
  }, [vg, hitMap]);

  const selectedId = focus?.kind === "node" ? focus.id : null;
  const inspection = useMemo(
    () => (selectedId ? inspectNode(graph, vg, selectedId) : null),
    [graph, vg, selectedId],
  );
  const impact = useMemo(
    () => (selectedId ? impactView(impactIndex, vg, selectedId) : null),
    [vg, impactIndex, selectedId],
  );
  const cycle = focus?.kind === "cycle" ? (cycles.find((c) => c.id === focus.id) ?? null) : null;

  const kindOf = useCallback(
    (id: string) => (vg.nodeById.get(id)?.kind ?? "file") as "file" | "external" | "builtin",
    [vg],
  );
  const pathOf = useCallback((id: string) => vg.nodeById.get(id)?.path ?? id, [vg]);

  // ------------------------------------------------------------------ actions
  const requestFocus = useCallback(
    (ids: string[]) => setFocusRequest((r) => ({ ids, seq: (r?.seq ?? 0) + 1 })),
    [],
  );

  const revealInTree = useCallback(
    (nodeId: string) => {
      const chain = ancestors.get(nodeId);
      if (!chain?.length || chain.every((a) => treeOpen.has(a))) return;
      setTreeOpen(new Set([...treeOpen, ...chain]));
    },
    [ancestors, treeOpen, setTreeOpen],
  );

  const selectModule = useCallback(
    (id: string, opts: { reveal?: boolean } = {}) => {
      setFocus({ kind: "node", id });
      if (!docked) setInspectorOpen(true);
      revealInTree(id);
      if (effGroup !== "none" && display.itemOf.get(id) !== id)
        setExpanded(expandTo(expanded, ancestors, id));
      else if (opts.reveal)
        requestFocus([
          ...computeHighlight(display, { kind: "node", id }, graph.findings, {
            itemOf: display.itemOf,
          }).nodes.keys(),
        ]);
    },
    [
      docked,
      revealInTree,
      effGroup,
      display,
      expanded,
      ancestors,
      setExpanded,
      requestFocus,
      graph.findings,
    ],
  );

  const expandGroup = useCallback(
    (id: string) => {
      const g = display.nodeById.get(id);
      setExpanded(new Set([...expanded, id]));
      setStatus(
        `Expanded ${g?.displayName ?? "group"}: ${plural(g?.memberCount ?? 0, "module")} now shown individually.`,
      );
    },
    [display, expanded, setExpanded],
  );

  const selectCycle = useCallback(
    (item: CycleItem) => {
      if (item.usesTypeOnly) setFilters((f) => (f.showTypeOnly ? f : { ...f, showTypeOnly: true }));
      setFocus({ kind: "cycle", id: item.id });
      // make every member individually visible
      if (effGroup !== "none") {
        const next = new Set(expanded);
        for (const m of item.members) for (const a of ancestors.get(m.id) ?? []) next.add(a);
        setExpanded(next);
      }
      requestFocus(item.members.map((m) => m.id));
      if (!docked) setInspectorOpen(true);
    },
    [docked, effGroup, expanded, ancestors, setExpanded, requestFocus],
  );

  const clearSelection = useCallback(() => setFocus(null), []);

  const resetAll = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setDirection("both");
    setGrouping("auto");
    setLayoutDir("RIGHT");
    setExpandedState(null);
    setTreeState(null);
    setQuery("");
    setFocus(null);
    setInspectorOpen(false);
    setFocusRequest(null);
    setFitSeq((n) => n + 1);
    setStatus("View reset: filters, grouping, search and selection cleared.");
  }, []);

  const chooseHit = (id: string) => selectModule(id, { reveal: true });

  const toggleFilter = (key: keyof ViewFilters) => {
    const next = { ...filters, [key]: !filters[key] };
    setFilters(next);
    if (
      key === "showExternals" &&
      !next.showExternals &&
      selectedId &&
      graph.nodes.find((n) => n.id === selectedId)?.kind !== "file"
    )
      setFocus(null);
  };

  const toggleTreeBranch = (id: string) => {
    const next = new Set(treeOpen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTreeOpen(next);
  };

  const collapseSelectionGroup = useMemo(() => {
    if (effGroup === "none" || !selectedId) return null;
    const { collapsed } = collapseAround(expanded, ancestors, selectedId);
    if (!collapsed) return null;
    const node = findTreeNode(tree, collapsed);
    return {
      name: node?.label ?? "group",
      onCollapse: () => {
        const res = collapseAround(expanded, ancestors, selectedId);
        setExpanded(res.next);
        setStatus(`Collapsed ${node?.label ?? "group"}.`);
      },
    };
  }, [effGroup, selectedId, expanded, ancestors, tree, setExpanded]);

  const exportSvg = () => {
    const svg = exportRef.current?.();
    if (!svg) {
      notify("The graph is not ready to export yet.", "error");
      return;
    }
    downloadText(`archmap-${safeFileStem(meta.id)}-graph.svg`, svg, "image/svg+xml");
    notify("SVG downloaded. It contains only drawn shapes and escaped text.");
  };

  const toggleFullscreen = () => {
    setFullscreen((f) => !f);
    setStatus(fullscreen ? "Left full screen." : "Graph is full screen. Press Escape to leave.");
  };

  // ------------------------------------------------------------------ effects
  // responsive default: list on phones, graph elsewhere. Decided once.
  useEffect(() => {
    setView(window.matchMedia("(min-width: 768px)").matches ? "graph" : "list");
    if (!demo) return;
    try {
      if (
        demo.autoTour !== false &&
        localStorage.getItem(TOUR_KEY) !== "1" &&
        window.matchMedia("(min-width: 768px)").matches
      )
        setTourStep(0);
    } catch {
      /* storage unavailable: skip the auto-open */
    }
    // once on mount
  }, []);

  // deep links: ?node= and ?cycle=
  const appliedDeepLink = useRef(false);
  useEffect(() => {
    if (appliedDeepLink.current || view === null) return;
    appliedDeepLink.current = true;
    if (initialNode && vg.nodeById.has(initialNode)) {
      selectModule(initialNode, { reveal: true });
    } else if (initialCycle) {
      const c = initialCycle === "first" ? cycles[0] : cycles.find((x) => x.id === initialCycle);
      if (c) selectCycle(c);
    }
  }, [view, initialNode, initialCycle, vg, cycles, selectModule, selectCycle]);

  // announcements for state that is otherwise only visual
  useEffect(() => {
    if (inspection)
      setStatus(
        `Selected ${inspection.node.path}. Imports ${inspection.outgoing.length} modules, imported by ${inspection.incoming.length}.`,
      );
    else if (cycle)
      setStatus(`${cycle.title} selected: ${cycle.members.map((m) => m.displayName).join(", ")}.`);
  }, [inspection, cycle]);

  // keyboard shortcuts (not while typing or while a dialog is open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      const dialogOpen = !!document.querySelector('[role="dialog"]');
      if (e.key === "Escape") {
        if (dialogOpen) return;
        if (query && t === searchInput.current) return; // the search box handles its own Escape
        if (fullscreen) setFullscreen(false);
        else if (focus) setFocus(null);
        return;
      }
      if (typing || dialogOpen) return;
      if (e.key === "/") {
        e.preventDefault();
        if (!leftOpen && wide) setLeftOpen(true);
        setTimeout(() => searchInput.current?.focus(), 0);
      } else if (e.key === "f" || e.key === "F") {
        if (view === "graph") setFitSeq((n) => n + 1);
      } else if (e.key === "?") setHelpOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, fullscreen, focus, leftOpen, wide, view]);

  // the page behind a full-screen graph must not scroll
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // ------------------------------------------------------------------ demo tour
  const closeTour = () => {
    setTourStep(null);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* the tour simply shows again next visit */
    }
  };
  const runTourAction = (a: TourAction) => {
    if (a === "show-list") setView("list");
    else if (a === "select-example") {
      const id = mostImportedFile(vg);
      if (id) selectModule(id, { reveal: true });
    } else if (a === "open-circular") demo?.onSampleChange("circular", { openCycle: true });
  };

  // ------------------------------------------------------------------ render pieces
  const hiddenCount = vg.hidden.externalEdges + vg.hidden.typeOnlyEdges;
  const groupingSummary =
    effGroup === "none"
      ? `Every module is drawn on its own. Automatic grouping starts above ${formatCount(400)} files.`
      : `${plural(vg.nodes.length, "module")} drawn as ${plural(display.nodes.length, "item")} (${plural(display.groups, "group")}), grouped by ${effGroup === "package" ? "package" : "folder"}. Click a group to expand it.`;

  const inspectorEl = (
    <Inspector
      focus={focus}
      inspection={inspection}
      impact={impact}
      cycle={cycle}
      cycles={cycles}
      filters={filters}
      onSelectNode={(id) => selectModule(id, { reveal: true })}
      onSelectCycle={(id) => {
        const c = cycles.find((x) => x.id === id);
        if (c) selectCycle(c);
      }}
      onClear={() => {
        clearSelection();
        setInspectorOpen(false);
      }}
      filesHref={(id) => `${basePath}/files?node=${encodeURIComponent(id)}`}
      group={collapseSelectionGroup}
    />
  );

  const mobileDrawerOpen = !docked && inspectorOpen && (inspection || cycle);
  const sectionsHidden = !wide && !mobileSections;
  const panelProps = {
    searchInputRef: searchInput,
    query,
    onQueryChange: setQuery,
    hits,
    showSearchResults: view === "graph",
    onChooseHit: chooseHit,
    rows: treeRows,
    kindOf,
    pathOf,
    selectedNodeId: selectedId,
    onToggleTree: toggleTreeBranch,
    onSelectLeaf: (id: string) => selectModule(id, { reveal: true }),
    onExpandTree: () => setTreeOpen(allBranchIds(tree)),
    onCollapseTree: () => setTreeOpen(new Set()),
    cycleNodeIds,
    filters,
    onToggleFilter: toggleFilter,
    direction,
    onDirection: setDirection,
    grouping,
    onGrouping: (g: GroupingMode) => {
      setGrouping(g);
      setExpandedState(null);
    },
    fileLevelAllowed,
    groupingSummary,
    layoutDirection: layoutDir,
    onLayoutDirection: setLayoutDir,
    cycles,
    activeCycleId: cycle?.id ?? null,
    onSelectCycle: selectCycle,
    unresolved: vg.unresolved,
  };

  const cols = [
    wide && leftOpen ? `${leftWidth}px 8px` : "",
    "minmax(0,1fr)",
    docked && rightOpen ? "360px" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={
        fullscreen ? "fixed inset-0 z-[55] flex flex-col bg-bg" : "flex min-h-0 flex-1 flex-col"
      }
    >
      <div className="sr-only-live" role="status" aria-live="polite">
        {status}
      </div>

      {/* demo chrome */}
      {demo && (
        <>
          <div className="border-b border-line bg-surface px-4 py-2 text-[13px] sm:px-6">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="am-chip border-primary-strong bg-primary-soft font-semibold">
                <Info size={13} aria-hidden="true" /> Demonstration data
              </span>
              <span>
                Real ARCHMAP analyzer output for{" "}
                <strong className="font-semibold">{meta.sample?.source}</strong>.
                <span className="max-sm:hidden"> {meta.sample?.description}</span>
              </span>
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 sm:hidden">
              <Link
                href="/import"
                className="inline-flex min-h-8 items-center gap-1.5 font-medium text-primary-strong underline underline-offset-2"
              >
                <Terminal size={14} aria-hidden="true" /> Analyze your own repo
              </Link>
              <Link
                href={basePath}
                className="inline-flex min-h-8 items-center font-medium text-primary-strong underline underline-offset-2"
              >
                Open the full workspace
              </Link>
            </div>
            <details className="mt-0.5">
              <summary className="inline-flex min-h-7 cursor-pointer items-center gap-1 text-primary-strong underline underline-offset-2">
                How this data was made <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="mt-1 space-y-1 text-muted">
                <p>
                  Generated by <code>pnpm demo:data</code> and committed as JSON; validated against
                  the ArchmapGraph schema when loaded. Command:
                </p>
                <pre className="overflow-x-auto rounded-md border border-line bg-bg px-2 py-1 text-[12px] text-ink">
                  <code>
                    archmap analyze {meta.sample?.command.replace(/^archmap analyze /, "")}
                  </code>
                </pre>
                <p>
                  Analyzer {graph.metadata.analyzerVersion}, {graph.metadata.compilerVersion},
                  schema {graph.metadata.schemaVersion}
                  {graph.metadata.repository.commit && (
                    <>, repository commit {graph.metadata.repository.commit.slice(0, 7)}</>
                  )}
                  . {graph.metadata.counts.filesAnalyzed} files analyzed, status{" "}
                  {graph.metadata.status}.
                </p>
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
        </>
      )}

      {/* toolbar */}
      <div
        role="toolbar"
        aria-label="Workspace tools"
        className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-4 py-2 sm:px-6"
      >
        {demo && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label htmlFor="sample" className="am-eyebrow flex-none">
              Sample
            </label>
            <select
              id="sample"
              className="am-field min-w-0 flex-1 sm:w-[16rem] sm:flex-none"
              value={demo.sampleId}
              onChange={(e) => demo.onSampleChange(e.target.value)}
            >
              {demo.samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div role="group" aria-label="View" className="flex gap-1">
          <button
            type="button"
            className={idleToolbarBtn}
            aria-pressed={view === "graph"}
            onClick={() => setView("graph")}
          >
            <Network size={16} aria-hidden="true" /> Graph
          </button>
          <button
            type="button"
            className={idleToolbarBtn}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={16} aria-hidden="true" /> List
          </button>
        </div>
        {view === "graph" && (
          <button
            type="button"
            className="am-btn"
            onClick={() => setFitSeq((n) => n + 1)}
            title="Fit the whole graph in view (F)"
          >
            <ScanSearch size={16} aria-hidden="true" /> <span className="max-sm:sr-only">Fit</span>
          </button>
        )}
        <button type="button" className="am-btn" onClick={resetAll}>
          <RotateCcw size={16} aria-hidden="true" /> <span className="max-sm:sr-only">Reset</span>
        </button>
        {view === "graph" && (
          <button
            type="button"
            className="am-btn"
            onClick={exportSvg}
            title="Download the graph as it is drawn now as a sanitized SVG"
          >
            <FileImage size={16} aria-hidden="true" />{" "}
            <span className="max-sm:sr-only">Export SVG</span>
          </button>
        )}
        {!docked && (inspection || cycle) && !inspectorOpen && (
          <button type="button" className="am-btn" onClick={() => setInspectorOpen(true)}>
            <PanelRightOpen size={16} aria-hidden="true" /> Details
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-1">
          {demo && (
            <>
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
              <Link href={basePath} className="am-btn max-lg:hidden">
                <ScanSearch size={16} aria-hidden="true" /> Full workspace
              </Link>
              <Link href="/import" className="am-btn am-btn-primary max-md:hidden">
                <Terminal size={16} aria-hidden="true" /> Analyze your own repo
              </Link>
            </>
          )}
          {wide && (
            <button
              type="button"
              className="am-btn"
              aria-pressed={leftOpen}
              onClick={() => setLeftOpen((o) => !o)}
              aria-label={leftOpen ? "Hide the explorer panel" : "Show the explorer panel"}
              title={leftOpen ? "Hide the explorer panel" : "Show the explorer panel"}
            >
              {leftOpen ? (
                <PanelLeftClose size={16} aria-hidden="true" />
              ) : (
                <PanelLeftOpen size={16} aria-hidden="true" />
              )}
            </button>
          )}
          {docked && (
            <button
              type="button"
              className="am-btn"
              aria-pressed={rightOpen}
              onClick={() => setRightOpen((o) => !o)}
              aria-label={rightOpen ? "Hide the inspector" : "Show the inspector"}
              title={rightOpen ? "Hide the inspector" : "Show the inspector"}
            >
              {rightOpen ? (
                <PanelRightClose size={16} aria-hidden="true" />
              ) : (
                <PanelRightOpen size={16} aria-hidden="true" />
              )}
            </button>
          )}
          <button
            ref={fullscreenButton}
            type="button"
            className="am-btn"
            aria-pressed={fullscreen}
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Leave full screen" : "Full screen"}
            title={fullscreen ? "Leave full screen (Esc)" : "Full screen"}
          >
            {fullscreen ? (
              <Minimize size={16} aria-hidden="true" />
            ) : (
              <Maximize size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div
        className="grid min-h-0 flex-1 md:[grid-template-columns:var(--am-cols)]"
        style={{ "--am-cols": cols } as React.CSSProperties}
      >
        {/* left panel */}
        {(wide ? leftOpen : true) && (
          <aside
            aria-label="Search, explorer and view options"
            className="flex min-h-0 flex-col border-b border-line bg-bg p-4 md:overflow-hidden md:border-b-0"
          >
            <LeftPanel
              {...panelProps}
              sectionsHidden={sectionsHidden}
              afterSearch={
                !wide ? (
                  <button
                    type="button"
                    className="am-btn w-full justify-between"
                    aria-expanded={mobileSections}
                    onClick={() => setMobileSections((o) => !o)}
                  >
                    Explorer, view options and cycles
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className={mobileSections ? "rotate-180" : ""}
                    />
                  </button>
                ) : null
              }
            />
          </aside>
        )}
        {wide && leftOpen && (
          <Splitter
            value={leftWidth}
            min={LEFT_MIN}
            max={LEFT_MAX}
            onChange={setLeftWidth}
            label="Resize the explorer panel"
          />
        )}

        {/* centre */}
        <section
          aria-label={view === "list" ? "Module list" : "Graph"}
          className="flex min-h-0 min-w-0 flex-col bg-surface"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-bg px-4 py-2 text-[13px] text-muted">
            <p className="min-w-0">
              {display.groups > 0 && view === "graph" ? (
                <>
                  {formatCount(vg.nodes.length)} modules drawn as{" "}
                  {formatCount(display.nodes.length)} items ({plural(display.groups, "group")})
                </>
              ) : (
                <>{formatCount(vg.nodes.length)} modules</>
              )}
              , {formatCount(vg.drawn.length)}{" "}
              {vg.drawn.length === 1 ? "dependency" : "dependencies"}
              {vg.unresolved.length > 0 && <>, {formatCount(vg.unresolved.length)} unresolved</>}
              {hiddenCount > 0 && (
                <>
                  . {hiddenCount} {hiddenCount === 1 ? "import is" : "imports are"} hidden by
                  filters
                </>
              )}
              {view === "graph" && !wide && (
                <>
                  . Pinch to zoom, or{" "}
                  <button
                    type="button"
                    className="font-medium text-primary-strong underline underline-offset-2"
                    onClick={() => setView("list")}
                  >
                    use the list view
                  </button>
                  .
                </>
              )}
            </p>
            {view === "graph" && effGroup !== "none" && (
              <span className="ml-auto flex gap-1">
                <button
                  type="button"
                  className="am-btn am-btn-sm"
                  onClick={() => setExpandedState(null)}
                >
                  Reset groups
                </button>
                <button
                  type="button"
                  className="am-btn am-btn-sm"
                  disabled={!fileLevelAllowed}
                  title={
                    fileLevelAllowed
                      ? "Show every module individually"
                      : `Too many modules to draw at once (limit ${formatCount(MAX_FILE_LEVEL_NODES)})`
                  }
                  onClick={() => setExpanded(expandAll(tree))}
                >
                  Expand all
                </button>
              </span>
            )}
          </div>
          {view === "graph" && effGroup !== "none" && isLarge(fileCount) && (
            <p className="border-b border-line bg-primary-soft px-4 py-1.5 text-[13px]">
              Large graph: starting grouped by {effGroup === "package" ? "package" : "folder"}.
              Click or press Enter on a group to expand it. Search and the explorer reveal
              individual modules.
            </p>
          )}
          <div
            className={
              view === "graph"
                ? "relative h-[68dvh] min-h-[380px] lg:h-auto lg:min-h-0 lg:flex-1"
                : "min-h-0 flex-1 bg-bg lg:overflow-y-auto"
            }
          >
            {view === null ? (
              <div
                role="status"
                className="grid h-full min-h-[240px] place-items-center p-6 text-sm text-muted"
              >
                Preparing the workspace&hellip;
              </div>
            ) : vg.nodes.length === 0 ? (
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
            ) : view === "graph" ? (
              <GraphCanvas
                display={display}
                focus={focus}
                findings={graph.findings}
                direction={direction}
                layoutDirection={layoutDir}
                matchIds={matchIds}
                onSelectModule={(id) => selectModule(id)}
                onExpandGroup={expandGroup}
                onClear={clearSelection}
                fitSeq={fitSeq}
                focusRequest={focusRequest}
                exportRef={exportRef}
                exportTitle={`ARCHMAP dependency graph: ${meta.repoLabel}`}
              />
            ) : (
              <ModuleList
                rows={rows}
                hits={hitMap}
                selectedId={selectedId}
                onSelect={(id) => selectModule(id)}
                caption={`Modules in ${meta.repoLabel} with their import counts`}
              />
            )}
          </div>
        </section>

        {/* docked inspector */}
        {docked && rightOpen && (
          <aside
            aria-label="Inspector"
            className="min-h-0 overflow-y-auto border-l border-line bg-bg p-4"
          >
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
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
