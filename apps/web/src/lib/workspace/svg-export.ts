import type { DrawnEdge, EdgeRole, Highlight, NodeRole } from "../graph/model";
import { NODE_HEIGHT, NODE_WIDTH, type LayoutData, type Point } from "../graph/layout-input";
import { roundedPath } from "../graph/route";
import type { DisplayKind, DisplayNode } from "./aggregate";

/**
 * Standalone SVG of the current graph view (spec 9.8, 14.1 "SVG injection").
 *
 * The file is generated from the layout, never from the DOM. Rules that keep it inert:
 * every string from the repository is XML-escaped text content (no attribute ever carries
 * repository data), every attribute value is a number or a constant from this file, and the
 * output contains no script, foreignObject, style element, event attribute, external
 * reference or DOCTYPE. `findSvgViolations` re-checks the finished string, and `toSafeSvg`
 * refuses to return anything that fails it.
 */

const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(s: string): string {
  return s
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const num = (v: number): string => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "0");

function truncate(s: string, max: number): string {
  const chars = [...s];
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join("")}…`;
}

const COLOR = {
  ink: "#151b2b",
  muted: "#526079",
  line: "#6b7a92",
  edge: "#7a88a1",
  primary: "#476cf0",
  primaryStrong: "#3452d1",
  accentStrong: "#5a50d9",
  cycle: "#b54708",
  warning: "#8a4b08",
  bg: "#ffffff",
  surface: "#f7f9fc",
  accentSoft: "#ece9fd",
  elevated: "#f1f5fb",
  warningSoft: "#fdf1dc",
} as const;

const KIND_ACCENT: Record<DisplayKind, string> = {
  file: COLOR.primary,
  external: COLOR.accentStrong,
  builtin: COLOR.muted,
  group: COLOR.ink,
};
const KIND_FILL: Record<DisplayKind, string> = {
  file: COLOR.bg,
  external: COLOR.accentSoft,
  builtin: COLOR.elevated,
  group: COLOR.surface,
};
const ROLE_STROKE: Record<NodeRole, string> = {
  selected: COLOR.primaryStrong,
  dependency: COLOR.primary,
  dependent: COLOR.accentStrong,
  both: COLOR.accentStrong,
  member: COLOR.cycle,
};
const EDGE_STROKE: Record<EdgeRole, string> = {
  outgoing: COLOR.primary,
  incoming: COLOR.accentStrong,
  cycle: COLOR.cycle,
};
const MARKERS = [
  ["base", COLOR.edge],
  ["outgoing", COLOR.primary],
  ["incoming", COLOR.accentStrong],
  ["cycle", COLOR.cycle],
] as const;

export interface SvgNodeInput {
  node: DisplayNode;
  x: number;
  y: number;
  role: NodeRole | null;
  match: boolean;
  dim: boolean;
}
export interface SvgEdgeInput {
  points: Point[];
  role: EdgeRole | null;
  typeOnly: boolean;
  dim: boolean;
}
export interface SvgInput {
  title: string;
  description: string;
  nodes: SvgNodeInput[];
  edges: SvgEdgeInput[];
}

const subOf = (n: DisplayNode): string => {
  if (n.kind === "group") return `${n.memberCount ?? 0} modules (collapsed group)`;
  if (n.kind === "external") return "external package";
  if (n.kind === "builtin") return "Node.js built-in";
  const i = n.path.lastIndexOf("/");
  return i > 0 ? n.path.slice(0, i) : "repository root";
};

export function buildSvg(input: SvgInput): string {
  const pad = 28;
  const foot = 34;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const n of input.nodes) {
    grow(n.x, n.y);
    grow(n.x + NODE_WIDTH, n.y + NODE_HEIGHT);
  }
  for (const e of input.edges) for (const p of e.points) grow(p.x, p.y);
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 240;
    maxY = 80;
  }
  const width = Math.max(maxX - minX + pad * 2, 320);
  const height = maxY - minY + pad * 2 + foot;
  const ox = pad - minX;
  const oy = pad - minY;

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(width)} ${num(height)}" width="${num(width)}" height="${num(height)}" role="img" font-family="Inter, Arial, sans-serif">`,
    `<title>${escapeXml(input.title)}</title>`,
    `<desc>${escapeXml(input.description)}</desc>`,
    `<rect width="${num(width)}" height="${num(height)}" fill="${COLOR.bg}"/>`,
    "<defs>",
  );
  for (const [name, color] of MARKERS)
    out.push(
      `<marker id="am-${name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>`,
    );
  out.push("</defs>", `<g transform="translate(${num(ox)} ${num(oy)})">`);

  // edges first so nodes sit on top; highlighted edges last among edges
  const edges = [...input.edges].sort((a, b) => Number(a.role !== null) - Number(b.role !== null));
  for (const e of edges) {
    if (e.points.length < 2) continue;
    const color = e.role ? EDGE_STROKE[e.role] : COLOR.edge;
    out.push(
      `<path d="${roundedPath(e.points)}" fill="none" stroke="${color}" stroke-width="${e.role ? 2.5 : 1.5}"${
        e.typeOnly ? ' stroke-dasharray="7 5"' : ""
      }${e.dim ? ' opacity="0.25"' : ""} marker-end="url(#am-${e.role ?? "base"})"/>`,
    );
  }
  for (const { node, x, y, role, match, dim } of input.nodes) {
    const stroke = role ? ROLE_STROKE[role] : match ? COLOR.warning : COLOR.line;
    const fill = match && !role ? COLOR.warningSoft : KIND_FILL[node.kind];
    const strokeWidth = role === "selected" || role === "member" ? 3 : role ? 2 : 1;
    out.push(
      `<g${dim ? ' opacity="0.3"' : ""}>`,
      `<title>${escapeXml(node.path)}</title>`,
      `<rect x="${num(x)}" y="${num(y)}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${
        node.kind === "group" ? ' stroke-dasharray="4 3"' : ""
      }/>`,
      `<rect x="${num(x)}" y="${num(y + 1)}" width="4" height="${NODE_HEIGHT - 2}" fill="${KIND_ACCENT[node.kind]}"/>`,
      `<text x="${num(x + 16)}" y="${num(y + 22)}" font-family="JetBrains Mono, Menlo, monospace" font-size="13" font-weight="600" fill="${COLOR.ink}">${escapeXml(truncate(node.displayName, 24))}</text>`,
      `<text x="${num(x + 16)}" y="${num(y + 40)}" font-size="11" fill="${COLOR.muted}">${escapeXml(truncate(subOf(node), 32))}</text>`,
      "</g>",
    );
  }
  out.push(
    "</g>",
    `<text x="${pad}" y="${num(height - 12)}" font-size="11" fill="${COLOR.muted}">${escapeXml(
      "Arrows point from the importing module to the imported module. Dashed lines are type-only imports. Generated by ARCHMAP.",
    )}</text>`,
    "</svg>",
  );
  return out.join("\n");
}

/**
 * Everything the exported SVG must never contain. Repository text is escaped, so `<` and `>`
 * only ever appear in markup; checks therefore run on the tags, not on text content.
 */
export function findSvgViolations(svg: string): string[] {
  const v: string[] = [];
  const tags = svg.match(/<[^>]*>/g) ?? [];
  const markup = tags.join("\n");
  if (svg.replace(/<[^>]*>/g, "").includes("<")) v.push("unbalanced markup");
  const checks: [RegExp, string][] = [
    [/<\s*script/i, "script element"],
    [/<\s*foreignObject/i, "foreignObject element"],
    [/<\s*style/i, "style element"],
    [
      /<\s*(iframe|object|embed|image|use|animate|set|a|link|meta|video|audio)[\s>/]/i,
      "active or referencing element",
    ],
    [/\son[a-z]+\s*=/i, "event handler attribute"],
    [/javascript\s*:/i, "javascript: URL"],
    [/data\s*:/i, "data: URL"],
    [/<!\s*(DOCTYPE|ENTITY|\[CDATA)/i, "DOCTYPE, ENTITY or CDATA"],
    [/<\?/, "processing instruction"],
    [/(?:xlink:)?href\s*=/i, "href attribute"],
  ];
  for (const [re, label] of checks) if (re.test(markup)) v.push(label);
  return v;
}

export class UnsafeSvgError extends Error {
  readonly violations: string[];
  constructor(violations: string[]) {
    super(`Refusing to export an SVG containing: ${violations.join(", ")}`);
    this.name = "UnsafeSvgError";
    this.violations = violations;
  }
}

export function toSafeSvg(input: SvgInput): string {
  const svg = buildSvg(input);
  const violations = findSvgViolations(svg);
  if (violations.length > 0) throw new UnsafeSvgError(violations);
  return svg;
}

/** Layout + highlight state -> SVG input. Nodes without a position are skipped. */
export function svgInputFrom(args: {
  title: string;
  description: string;
  nodes: DisplayNode[];
  drawn: DrawnEdge[];
  layout: LayoutData;
  highlight: Highlight;
  matches: Set<string> | null;
}): SvgInput {
  const { nodes, drawn, layout, highlight, matches } = args;
  return {
    title: args.title,
    description: args.description,
    nodes: nodes.flatMap((node) => {
      const pos = layout.positions.get(node.id);
      if (!pos) return [];
      const role = highlight.nodes.get(node.id) ?? null;
      const match = matches?.has(node.id) ?? false;
      return [
        {
          node,
          x: pos.x,
          y: pos.y,
          role,
          match,
          dim: highlight.active ? role === null : matches !== null ? !match : false,
        },
      ];
    }),
    edges: drawn.flatMap((e) => {
      const points = layout.routes.get(e.id);
      if (!points) return [];
      const role = highlight.edges.get(e.id) ?? null;
      return [
        {
          points,
          role,
          typeOnly: e.dependencyClass === "type-only",
          dim: highlight.active ? role === null : false,
        },
      ];
    }),
  };
}
