"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, ChevronRight, Cpu, FileCode2, Folder, Package } from "lucide-react";
import type { TreeRow } from "../../lib/workspace/tree";

const ROW_H = 32;
/** Below this many rows everything is rendered; above it only the visible window (plus overscan). */
const WINDOW_AT = 250;
const OVERSCAN = 12;

const LEAF_ICON = { file: FileCode2, external: Box, builtin: Cpu } as const;

export interface ExplorerTreeProps {
  rows: TreeRow[];
  /** Graph node kind per leaf, for the icon. */
  kindOf: (nodeId: string) => "file" | "external" | "builtin";
  pathOf: (nodeId: string) => string;
  selectedNodeId: string | null;
  onToggle: (id: string) => void;
  onSelectLeaf: (nodeId: string) => void;
  /** Nodes that belong to a cycle get a text marker, never colour alone. */
  cycleNodeIds: ReadonlySet<string>;
  label: string;
}

/**
 * Keyboard-navigable tree (WAI-ARIA tree pattern, flat rows with aria-level).
 * Arrow Up/Down move, Right expands or enters, Left collapses or goes to the parent,
 * Home/End jump, Enter or Space activates. Large trees are windowed.
 */
export function ExplorerTree({
  rows,
  kindOf,
  pathOf,
  selectedNodeId,
  onToggle,
  onSelectLeaf,
  cycleNodeIds,
  label,
}: ExplorerTreeProps) {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(360);
  const focusAfter = useRef(false);

  const windowed = rows.length > WINDOW_AT;
  const activeIndex = Math.max(
    0,
    rows.findIndex((r) => r.id === active),
  );
  const tabbable = rows[activeIndex]?.id ?? rows[0]?.id;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setViewH(el.clientHeight);
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scrollToIndex = (i: number) => {
    const el = box.current;
    if (!el) return;
    const top = i * ROW_H;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_H > el.scrollTop + el.clientHeight)
      el.scrollTop = top + ROW_H - el.clientHeight;
  };

  // reveal the selected module when selection changes from elsewhere (graph, search)
  useEffect(() => {
    if (!selectedNodeId) return;
    const i = rows.findIndex((r) => r.nodeId === selectedNodeId);
    if (i >= 0) scrollToIndex(i);
    // only when the selection changes
  }, [selectedNodeId]);

  // move DOM focus after a keyboard move, once the target row exists in the DOM
  useEffect(() => {
    if (!focusAfter.current || !box.current) return;
    const el = box.current.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(tabbable ?? "")}"]`,
    );
    if (!el) return; // not windowed in yet; the scroll event re-renders and we retry
    focusAfter.current = false;
    el.focus();
  });

  const move = (i: number) => {
    const next = rows[Math.max(0, Math.min(rows.length - 1, i))];
    if (!next) return;
    focusAfter.current = true;
    setActive(next.id);
    scrollToIndex(rows.indexOf(next));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const row = rows[activeIndex];
    if (!row) return;
    switch (e.key) {
      case "ArrowDown":
        move(activeIndex + 1);
        break;
      case "ArrowUp":
        move(activeIndex - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(rows.length - 1);
        break;
      case "ArrowRight":
        if (row.hasChildren && !row.expanded) onToggle(row.id);
        else if (row.hasChildren) move(activeIndex + 1);
        break;
      case "ArrowLeft":
        if (row.hasChildren && row.expanded) onToggle(row.id);
        else {
          for (let i = activeIndex - 1; i >= 0; i--)
            if (rows[i]!.depth < row.depth) {
              move(i);
              break;
            }
        }
        break;
      case "Enter":
      case " ":
        if (row.nodeId) onSelectLeaf(row.nodeId);
        else if (row.hasChildren) onToggle(row.id);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const start = windowed ? Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN) : 0;
  const end = windowed
    ? Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN)
    : rows.length;
  // keep the keyboard-active row mounted even if it scrolled out of the window
  const visible = rows.slice(start, end);

  if (rows.length === 0)
    return (
      <p className="px-1 py-3 text-[13px] text-muted" role="status">
        Nothing to show with the current search and filters.
      </p>
    );

  return (
    <div
      ref={box}
      role="tree"
      aria-label={label}
      aria-multiselectable="false"
      tabIndex={visible.some((r) => r.id === tabbable) ? undefined : 0}
      onKeyDown={onKeyDown}
      onScroll={windowed ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
      className="relative max-h-[min(60vh,32rem)] min-h-24 overflow-y-auto overscroll-contain rounded-lg border border-line bg-bg lg:max-h-none lg:min-h-0 lg:flex-1"
    >
      <div style={windowed ? { height: rows.length * ROW_H, position: "relative" } : undefined}>
        {visible.map((r, k) => {
          const selected = r.nodeId !== undefined && r.nodeId === selectedNodeId;
          const Icon = r.nodeId
            ? LEAF_ICON[kindOf(r.nodeId)]
            : r.kind === "package"
              ? Package
              : Folder;
          const inCycle = r.nodeId ? cycleNodeIds.has(r.nodeId) : false;
          return (
            <div
              key={r.id}
              data-row-id={r.id}
              role="treeitem"
              aria-level={r.depth + 1}
              aria-posinset={r.pos}
              aria-setsize={r.size}
              aria-expanded={r.hasChildren ? r.expanded : undefined}
              aria-selected={r.nodeId ? selected : undefined}
              tabIndex={r.id === tabbable ? 0 : -1}
              title={r.nodeId ? pathOf(r.nodeId) : r.label}
              onFocus={() => {
                focusAfter.current = false;
                setActive(r.id);
              }}
              onClick={() => {
                setActive(r.id);
                if (r.nodeId) onSelectLeaf(r.nodeId);
                else if (r.hasChildren) onToggle(r.id);
              }}
              style={{
                paddingLeft: 8 + r.depth * 14,
                height: ROW_H,
                ...(windowed
                  ? { position: "absolute", top: (start + k) * ROW_H, left: 0, right: 0 }
                  : {}),
              }}
              className={`am-tree-row flex cursor-pointer items-center gap-1.5 pr-2 text-[13px] ${
                selected
                  ? "bg-primary-soft font-semibold shadow-[inset_3px_0_0_var(--color-primary-strong)]"
                  : "hover:bg-elevated"
              }`}
            >
              {r.hasChildren ? (
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className={`flex-none text-muted transition-transform duration-150 ${r.expanded ? "rotate-90" : ""}`}
                />
              ) : (
                <span className="w-3.5 flex-none" aria-hidden="true" />
              )}
              <Icon size={15} aria-hidden="true" className="flex-none text-muted" />
              <span
                className={`min-w-0 flex-1 truncate ${r.nodeId ? "font-mono text-[12.5px]" : ""}`}
              >
                {r.label}
              </span>
              {inCycle && (
                <span className="flex-none rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning">
                  cycle
                </span>
              )}
              {r.hasChildren && (
                <span className="flex-none text-[12px] tabular-nums text-muted">{r.count}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
