"use client";

import { useId, useMemo } from "react";
import {
  computeHighlight,
  type Direction,
  type EdgeRole,
  type NodeRole,
} from "../../lib/graph/model";
import { roundedPath } from "../../lib/graph/route";
import { PREVIEW_NODE } from "../../lib/landing/preview-size";
import type { PreviewData } from "../../lib/landing/preview";

const NODE_WIDTH = PREVIEW_NODE.width;
const NODE_HEIGHT = PREVIEW_NODE.height;

const NODE_STROKE: Record<NodeRole, string> = {
  selected: "var(--color-primary-strong)",
  dependency: "var(--color-primary)",
  dependent: "var(--color-accent-strong)",
  both: "var(--color-accent-strong)",
  member: "var(--color-cycle)",
};
const EDGE_STROKE: Record<EdgeRole | "base", string> = {
  base: "var(--color-edge)",
  outgoing: "var(--color-primary)",
  incoming: "var(--color-accent-strong)",
  cycle: "var(--color-cycle)",
};
const TAG: Record<NodeRole, string | null> = {
  selected: "selected",
  dependency: "imported",
  dependent: "imports",
  both: "mutual",
  member: "cycle",
};
const KIND_ACCENT = {
  file: "var(--color-primary)",
  external: "var(--color-accent-strong)",
  builtin: "var(--color-muted)",
  group: "var(--color-ink)",
} as const;

export interface GraphPreviewProps {
  data: PreviewData;
  label: string;
  /** Selected module id (a file, or a package group). */
  selected?: string | null;
  /** Highlight a cycle finding instead of a selection. */
  cycleId?: string | null;
  direction?: Direction;
  /** Extra edges to emphasise, by drawn-edge id (used by the code-to-graph story). */
  edgeFocus?: string | null;
  onSelect?: (id: string | null) => void;
  /** Stagger node entrance with CSS (hero only). Content is visible without it. */
  entrance?: boolean;
  className?: string;
  /** Narrow screens: keep the drawing at least this wide and let it scroll sideways. */
  minWidth?: number;
}

/**
 * Static-first SVG rendering of a pre-laid-out real graph. The same highlight model as the
 * workspace (computeHighlight) drives selection, so what you see here is what the product does.
 */
export function GraphPreview({
  data,
  label,
  selected = null,
  cycleId = null,
  direction = "both",
  edgeFocus = null,
  onSelect,
  entrance = false,
  className = "",
  minWidth,
}: GraphPreviewProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const itemOf = useMemo(() => new Map(Object.entries(data.itemOf)), [data]);
  const visibleIds = useMemo(() => new Set(data.nodes.map((n) => n.id)), [data]);
  const highlight = useMemo(
    () =>
      cycleId
        ? computeHighlight(
            { visibleIds, drawn: data.drawn },
            { kind: "cycle", id: cycleId },
            data.findings,
            { itemOf },
          )
        : selected
          ? computeHighlight(
              { visibleIds, drawn: data.drawn },
              { kind: "node", id: selected },
              data.findings,
              { direction, itemOf },
            )
          : null,
    [cycleId, selected, direction, data, visibleIds, itemOf],
  );
  const interactive = !!onSelect;
  const focusEdge = edgeFocus ? data.drawn.find((e) => e.id === edgeFocus) : null;

  const edges = [...data.drawn].sort(
    (a, b) =>
      Number(highlight?.edges.has(a.id) ?? false) - Number(highlight?.edges.has(b.id) ?? false),
  );
  return (
    <div
      role="region"
      aria-label={`${label} (scrollable)`}
      tabIndex={0}
      className={`overflow-x-auto rounded-[inherit] ${className}`}
    >
      <svg
        viewBox={`-4 -4 ${data.width} ${data.height}`}
        role="group"
        aria-label={label}
        className="mx-auto block h-auto w-full"
        style={minWidth ? { minWidth } : undefined}
        onClick={(e) => {
          if (interactive && e.target === e.currentTarget) onSelect?.(null);
        }}
      >
        <defs>
          {(Object.keys(EDGE_STROKE) as (EdgeRole | "base")[]).map((k) => (
            <marker
              key={k}
              id={`${uid}-${k}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M0 0L10 5L0 10z" fill={EDGE_STROKE[k]} />
            </marker>
          ))}
        </defs>
        {edges.map((e) => {
          const pts = data.routes[e.id];
          if (!pts) return null;
          const role = highlight?.edges.get(e.id) ?? null;
          const focused = focusEdge?.id === e.id;
          const dim = highlight?.active ? role === null : edgeFocus ? !focused : false;
          const stroke = focused ? "var(--color-cycle)" : EDGE_STROKE[role ?? "base"];
          return (
            <path
              key={e.id}
              d={roundedPath(pts)}
              fill="none"
              stroke={stroke}
              strokeWidth={role || focused ? 2.5 : 1.5}
              strokeDasharray={e.dependencyClass === "type-only" ? "7 5" : undefined}
              opacity={dim ? 0.18 : 1}
              markerEnd={`url(#${uid}-${focused ? "cycle" : (role ?? "base")})`}
              style={{ transition: "opacity 180ms var(--ease-out-soft)" }}
            />
          );
        })}
        {data.nodes.map((n, i) => {
          const pos = data.positions[n.id];
          if (!pos) return null;
          const role = highlight?.nodes.get(n.id) ?? null;
          const dim = highlight?.active
            ? role === null
            : edgeFocus
              ? !(focusEdge && (focusEdge.source === n.id || focusEdge.target === n.id))
              : false;
          const isGroup = n.kind === "group";
          const sub = isGroup
            ? `${n.memberCount} modules`
            : n.kind === "file"
              ? dirOf(n.path) || "repository root"
              : n.kind === "external"
                ? "external package"
                : "Node.js built-in";
          const isSel = n.id === (selected && itemOf.get(selected)) && !cycleId;
          const tag = role ? TAG[role] : null;
          const name = isGroup ? n.displayName : n.displayName;
          // the accessible name must contain every visible text: name, subtitle, tag
          const aria = `${n.displayName}, ${sub}${tag ? `, ${tag}` : ""}, ${isGroup ? "package group" : n.kind === "file" ? "file" : n.kind}`;
          const tagW = tag ? tag.length * 6.4 + 12 : 0;
          const clipId = `${uid}-c${i}`;
          return (
            <g
              key={n.id}
              transform={`translate(${pos.x} ${pos.y})`}
              role={interactive ? "button" : undefined}
              aria-label={interactive ? aria : undefined}
              aria-pressed={interactive ? isSel : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => onSelect?.(isSel ? null : n.id) : undefined}
              onKeyDown={
                interactive
                  ? (ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        onSelect?.(isSel ? null : n.id);
                      }
                    }
                  : undefined
              }
              className={`${interactive ? "cursor-pointer outline-none [&:focus-visible>rect:first-of-type]:stroke-[3px] [&:focus-visible>rect:first-of-type]:stroke-focus" : ""} ${entrance ? "am-node-in" : ""}`}
              style={{
                transition: "opacity 150ms var(--ease-out-soft)",
                animationDelay: entrance ? `${Math.min(i, 24) * 28}ms` : undefined,
              }}
            >
              <clipPath id={clipId}>
                <rect x={0} y={-12} width={NODE_WIDTH - 8} height={NODE_HEIGHT + 12} />
              </clipPath>
              {isGroup && (
                <rect
                  x={5}
                  y={5}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill="var(--color-bg)"
                  stroke="var(--color-control)"
                />
              )}
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={8}
                fill={
                  dim
                    ? "var(--color-surface)"
                    : n.kind === "external"
                      ? "var(--color-accent-soft)"
                      : n.kind === "builtin"
                        ? "var(--color-elevated)"
                        : isGroup
                          ? "var(--color-surface)"
                          : "var(--color-bg)"
                }
                stroke={
                  role ? NODE_STROKE[role] : dim ? "var(--color-line)" : "var(--color-control)"
                }
                strokeWidth={role === "selected" || role === "member" ? 3 : role ? 2 : 1}
                strokeDasharray={isGroup ? "5 3" : undefined}
              />
              <rect
                x={0}
                y={1}
                width={4}
                height={NODE_HEIGHT - 2}
                fill={dim ? "var(--color-line)" : KIND_ACCENT[n.kind]}
              />
              {tag && (
                <rect
                  x={NODE_WIDTH - 8 - tagW}
                  y={-9}
                  width={tagW}
                  height={17}
                  rx={8.5}
                  fill="var(--color-ink)"
                />
              )}
              {/* One <text> holds name, subtitle and tag, so assistive tech and axe read it as the node's visible label. */}
              <text
                fontFamily="var(--font-mono)"
                fontSize={13}
                fontWeight={dim ? 500 : 600}
                fill={dim ? "var(--color-muted)" : "var(--color-ink)"}
                clipPath={`url(#${clipId})`}
              >
                <tspan x={16} y={22}>
                  {name}
                </tspan>{" "}
                <tspan
                  x={16}
                  y={38}
                  fontFamily="var(--font-sans)"
                  fontSize={11.5}
                  fontWeight={400}
                  fill="var(--color-muted)"
                >
                  {sub}
                </tspan>
                {tag && (
                  <>
                    {" "}
                    <tspan
                      x={NODE_WIDTH - 8 - tagW + 6}
                      y={3.5}
                      fontFamily="var(--font-sans)"
                      fontSize={10.5}
                      fontWeight={600}
                      fill="#fff"
                    >
                      {tag}
                    </tspan>
                  </>
                )}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : "";
}
