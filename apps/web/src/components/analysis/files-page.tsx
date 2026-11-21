"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { GraphEdge, GraphNode } from "@archmap/graph-schema";
import { buildFileIndex, fileDetail, type FileEdgeRow } from "../../lib/workspace/files";
import {
  allBranchIds,
  ancestorMap,
  buildTree,
  flattenTree,
  type GroupBy,
} from "../../lib/workspace/tree";
import { buildSearchIndex, searchPaths } from "../../lib/graph/search";
import { formatCount } from "../../lib/format";
import { Badge } from "../ui/primitives";
import { CopyButton } from "../ui/copy-button";
import { ExplorerTree } from "../workspace/explorer-tree";
import { useReadyAnalysis } from "./provider";
import { EmptyNote, PageFrame } from "./parts";

export function FilesPage() {
  return (
    <Suspense fallback={null}>
      <Files />
    </Suspense>
  );
}

const KIND_LABEL = {
  file: "Source file",
  external: "External package",
  builtin: "Node.js built-in",
} as const;

function Files() {
  const { id, graph } = useReadyAnalysis();
  const base = `/analyses/${id}`;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get("node");
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("directory");
  const heading = useRef<HTMLHeadingElement>(null);

  const index = useMemo(() => buildFileIndex(graph), [graph]);
  const tree = useMemo(() => buildTree(graph.nodes, groupBy), [graph, groupBy]);
  const ancestors = useMemo(() => ancestorMap(tree), [tree]);
  const [open, setOpen] = useState<{ key: string; set: Set<string> } | null>(null);
  const key = `${groupBy}`;
  const defaultOpen = useMemo(
    () =>
      tree.count <= 150
        ? allBranchIds(tree)
        : new Set(tree.children.filter((c) => c.nodeId === undefined).map((c) => c.id)),
    [tree],
  );
  const treeOpen = open?.key === key ? open.set : defaultOpen;
  const searchIndex = useMemo(() => buildSearchIndex(graph.nodes), [graph]);
  const matchIds = useMemo(
    () =>
      query.trim() ? new Set(searchPaths(searchIndex, query, 100_000).map((h) => h.id)) : null,
    [searchIndex, query],
  );
  const rows = useMemo(() => flattenTree(tree, treeOpen, matchIds), [tree, treeOpen, matchIds]);
  const detail = useMemo(
    () => (selectedId ? fileDetail(index, selectedId) : null),
    [index, selectedId],
  );
  const cycleIds = useMemo(
    () =>
      new Set(
        graph.findings
          .filter((f) => f.category === "runtime-cycle" || f.category === "type-cycle")
          .flatMap((f) => f.nodes),
      ),
    [graph],
  );

  const select = useCallback(
    (nodeId: string) =>
      router.replace(`${pathname}?node=${encodeURIComponent(nodeId)}`, { scroll: false }),
    [router, pathname],
  );

  // reveal a deep-linked file in the tree and move focus to its heading (once per selection)
  useEffect(() => {
    if (!selectedId) return;
    const chain = ancestors.get(selectedId);
    if (chain && !chain.every((a) => treeOpen.has(a)))
      setOpen({ key, set: new Set([...treeOpen, ...chain]) });
    // only when the selection changes
  }, [selectedId]);

  const toggle = (rowId: string) => {
    const next = new Set(treeOpen);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    setOpen({ key, set: next });
  };

  return (
    <PageFrame wide>
      <header className="mb-6 max-w-3xl">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Files</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Every analyzed file with the imports the analyzer found in it and the files that import
          it. ARCHMAP records which modules depend on which, with the source line as evidence. It
          does not extract symbols, so named exports and imported names are not listed.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 lg:sticky lg:top-20 lg:h-[calc(100dvh-8rem)] lg:self-start">
          <div>
            <label htmlFor="file-search" className="am-eyebrow">
              Search files by path
            </label>
            <div className="relative mt-1.5">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="file-search"
                type="text"
                autoComplete="off"
                spellCheck={false}
                className="am-field pl-9 pr-10"
                placeholder="e.g. graph-core"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              />
              {query && (
                <button
                  type="button"
                  className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-elevated"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[13px] text-muted" role="status">
              {matchIds
                ? `${formatCount(matchIds.size)} ${matchIds.size === 1 ? "match" : "matches"}`
                : `${formatCount(graph.nodes.length)} modules`}
            </p>
          </div>
          <div role="group" aria-label="Group files by" className="flex gap-1">
            <button
              type="button"
              className="am-btn am-btn-sm flex-1"
              aria-pressed={groupBy === "directory"}
              onClick={() => setGroupBy("directory")}
            >
              Folders
            </button>
            <button
              type="button"
              className="am-btn am-btn-sm flex-1"
              aria-pressed={groupBy === "package"}
              onClick={() => setGroupBy("package")}
            >
              Packages
            </button>
          </div>
          <ExplorerTree
            label="Files and packages"
            rows={rows}
            kindOf={(nid) =>
              (index.nodeById.get(nid)?.kind ?? "file") as "file" | "external" | "builtin"
            }
            pathOf={(nid) => index.nodeById.get(nid)?.path ?? nid}
            selectedNodeId={selectedId}
            onToggle={toggle}
            onSelectLeaf={(nid) => {
              select(nid);
              heading.current?.focus();
            }}
            cycleNodeIds={cycleIds}
          />
        </div>

        <section aria-label="File details" className="min-w-0">
          {detail ? (
            <Detail
              base={base}
              detail={detail}
              select={select}
              headingRef={heading}
              inCycle={cycleIds.has(detail.node.id)}
            />
          ) : selectedId ? (
            <EmptyNote>
              No module with id <code className="break-all">{selectedId}</code> exists in this
              analysis.
            </EmptyNote>
          ) : (
            <div className="am-card p-6">
              <h3 className="font-display text-lg font-semibold">Choose a file</h3>
              <p className="mt-1 max-w-prose text-[15px] text-muted">
                Pick a file in the tree to see what it imports, which files import it, the exact
                statement behind each edge, and any imports the analyzer could not resolve. Use the
                arrow keys inside the tree; Enter opens a file.
              </p>
            </div>
          )}
        </section>
      </div>
    </PageFrame>
  );
}

function Detail({
  base,
  detail,
  select,
  headingRef,
  inCycle,
}: {
  base: string;
  detail: NonNullable<ReturnType<typeof fileDetail>>;
  select: (id: string) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  inCycle: boolean;
}) {
  const n = detail.node;
  const facts: [string, React.ReactNode][] = [
    [
      "Path",
      <code key="p" className="break-all">
        {n.path}
      </code>,
    ],
    ["Kind", KIND_LABEL[n.kind]],
    ["Language", n.language ?? "not applicable"],
    ["Package", n.package ?? "none"],
    [
      "Node ID",
      <code key="i" className="break-all">
        {n.id}
      </code>,
    ],
  ];
  return (
    <div className="space-y-8">
      <header className="am-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 break-all font-mono text-lg font-semibold outline-none"
          >
            {n.displayName}
          </h3>
          <div className="flex flex-wrap gap-2">
            {inCycle && <Badge tone="warning">in a cycle</Badge>}
            <CopyButton text={n.path} label="Copy path" announce="Path copied to clipboard" />
            <Link
              href={`${base}?node=${encodeURIComponent(n.id)}`}
              className="am-btn am-btn-sm am-btn-primary"
            >
              Open in graph
            </Link>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-[14px]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {n.kind === "file" && (
        <>
          <EdgeSection
            title="Imports"
            rows={detail.imports}
            select={select}
            empty="This file imports nothing the analyzer could see."
            direction="out"
          />
          <EdgeSection
            title="Re-exports (export … from)"
            rows={detail.reExports}
            select={select}
            empty="No re-exports from other modules."
            direction="out"
          />
        </>
      )}
      <EdgeSection
        title="Imported by"
        rows={detail.importedBy}
        select={select}
        empty="No other module in this analysis imports it."
        direction="in"
      />
      {detail.unresolved.length > 0 && (
        <EdgeSection
          title="Unresolved imports"
          rows={detail.unresolved}
          select={select}
          empty=""
          direction="out"
          unresolved
        />
      )}

      <section
        aria-labelledby="sym-h"
        className="rounded-xl border border-dashed border-control bg-surface px-5 py-4"
      >
        <h4 id="sym-h" className="font-display text-[15px] font-semibold">
          Symbols and exports
        </h4>
        <p className="mt-1 max-w-prose text-[14px] leading-relaxed text-muted">
          Not available. This analysis works at module level: it knows that one file imports another
          and where the statement is, not which names cross the boundary. Named exports, default
          exports and imported identifiers are not extracted. See{" "}
          <Link
            href="/docs/analysis-coverage"
            className="text-primary-strong underline underline-offset-2"
          >
            analysis coverage
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function EdgeSection({
  title,
  rows,
  select,
  empty,
  direction,
  unresolved = false,
}: {
  title: string;
  rows: FileEdgeRow[];
  select: (id: string) => void;
  empty: string;
  direction: "in" | "out";
  unresolved?: boolean;
}) {
  const id = title.replace(/\W+/g, "-").toLowerCase();
  return (
    <section aria-labelledby={`${id}-h`}>
      <h4 id={`${id}-h`} className="font-display text-base font-semibold">
        {title} ({rows.length})
      </h4>
      {rows.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">{empty}</p>
      ) : (
        <div className="am-table-wrap mt-2">
          <table className="am-table">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">
                  {direction === "in" ? "Imported by" : unresolved ? "Specifier" : "Module"}
                </th>
                <th scope="col">Statement</th>
                <th scope="col">Location</th>
                <th scope="col">Kind</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map(({ edge, peer }) => (
                <tr key={edge.id}>
                  <th scope="row" className="min-w-[10rem]">
                    <PeerCell edge={edge} peer={peer} select={select} unresolved={unresolved} />
                  </th>
                  <td className="break-words font-mono text-[12.5px] text-muted">
                    <code>{edge.evidence.text}</code>
                  </td>
                  <td className="whitespace-nowrap font-mono text-[12.5px]">
                    {edge.evidence.file}:{edge.evidence.line}:{edge.evidence.column}
                  </td>
                  <td className="whitespace-nowrap text-[13px]">
                    {edge.importKind}{" "}
                    <Badge className={edge.dependencyClass === "type-only" ? "border-dashed" : ""}>
                      {edge.dependencyClass}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 300 && (
        <p className="mt-2 text-[13px] text-muted">Showing 300 of {formatCount(rows.length)}.</p>
      )}
    </section>
  );
}

function PeerCell({
  edge,
  peer,
  select,
  unresolved,
}: {
  edge: GraphEdge;
  peer: GraphNode | null;
  select: (id: string) => void;
  unresolved: boolean;
}) {
  if (unresolved || !peer)
    return (
      <span className="break-all font-mono text-[12.5px]">
        <code>{edge.specifier}</code>
        {edge.diagnostic && (
          <span className="mt-0.5 block font-sans text-[12px] font-normal text-danger">
            {edge.diagnostic}
          </span>
        )}
      </span>
    );
  return (
    <button
      type="button"
      className="break-all text-left font-mono text-[12.5px] font-semibold text-primary-strong underline underline-offset-2"
      onClick={() => select(peer.id)}
      aria-label={`Show ${peer.path}`}
    >
      {peer.path}
    </button>
  );
}
