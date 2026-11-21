import ELK from "elkjs/lib/elk.bundled.js";
import type { ArchmapGraph, Finding } from "@archmap/graph-schema";
import { DEFAULT_FILTERS, deriveVisible, type DrawnEdge } from "../graph/model";
import { toElkGraph, toLayoutData, type Point } from "../graph/layout-input";
import { PREVIEW_NODE } from "./preview-size";
import { deriveDisplay, ungroupedDisplay, type DisplayNode } from "../workspace/aggregate";
import { buildTree } from "../workspace/tree";

/**
 * Layout for the landing page's graph previews, computed on the server at build time from the
 * real demo JSON. The result is plain data, so the previews render as SVG without any
 * JavaScript and become interactive once the client component hydrates.
 */
export interface PreviewData {
  nodes: DisplayNode[];
  drawn: DrawnEdge[];
  itemOf: Record<string, string>;
  positions: Record<string, Point>;
  routes: Record<string, Point[]>;
  width: number;
  height: number;
  findings: Finding[];
  /** Totals of the underlying real graph, for captions. */
  counts: { files: number; imports: number; cycles: number };
}

export interface PreviewOptions {
  showExternals?: boolean;
  /** Collapse every package into one node. */
  collapseToPackages?: boolean;
  direction?: "RIGHT" | "DOWN";
}

export async function buildPreview(
  graph: ArchmapGraph,
  opts: PreviewOptions = {},
): Promise<PreviewData> {
  const vg = deriveVisible(graph, {
    ...DEFAULT_FILTERS,
    showExternals: opts.showExternals ?? true,
  });
  const display = opts.collapseToPackages
    ? deriveDisplay(vg, buildTree(vg.nodes, "package"), new Set())
    : ungroupedDisplay(vg);
  const laid = toLayoutData(
    await new ELK().layout(toElkGraph(display, opts.direction ?? "RIGHT", PREVIEW_NODE)),
  );
  let width = 0;
  let height = 0;
  const positions: Record<string, Point> = {};
  for (const [id, p] of laid.positions) {
    positions[id] = p;
    width = Math.max(width, p.x + PREVIEW_NODE.width);
    height = Math.max(height, p.y + PREVIEW_NODE.height);
  }
  const routes: Record<string, Point[]> = {};
  for (const [id, pts] of laid.routes) {
    routes[id] = pts;
    for (const p of pts) {
      width = Math.max(width, p.x);
      height = Math.max(height, p.y);
    }
  }
  return {
    nodes: display.nodes,
    drawn: display.drawn,
    itemOf: Object.fromEntries(display.itemOf),
    positions,
    routes,
    width: width + 8,
    height: height + 8,
    findings: graph.findings.filter(
      (f) => f.category === "runtime-cycle" || f.category === "type-cycle",
    ),
    counts: {
      files: graph.nodes.filter((n) => n.kind === "file").length,
      imports: graph.edges.length,
      cycles: graph.findings.filter((f) => f.category === "runtime-cycle").length,
    },
  };
}
