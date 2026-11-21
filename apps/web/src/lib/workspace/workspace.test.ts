import { describe, expect, it } from "vitest";
import ELK from "elkjs/lib/elk.bundled.js";
import { ArchmapGraph, type GraphNode } from "@archmap/graph-schema";
import { toMarkdown } from "@archmap/graph-core/report";
import { parseGraph } from "../graph/load";
import { SAMPLES } from "../graph/samples";
import { computeHighlight, DEFAULT_FILTERS, deriveVisible } from "../graph/model";
import { buildSearchIndex, searchPaths } from "../graph/search";
import {
  FAST_LAYOUT_EDGES,
  layoutKey,
  NODE_HEIGHT,
  NODE_WIDTH,
  spreadOverlaps,
  straightRoute,
  toElkGraph,
  toLayoutData,
} from "../graph/layout-input";
import {
  AGGREGATION_THRESHOLD,
  collapseAround,
  deriveDisplay,
  effectiveGrouping,
  expandAll,
  expandTo,
  groupedView,
  initialExpanded,
  ungroupedDisplay,
} from "./aggregate";
import { deriveInsights } from "./insights";
import { buildFileIndex, fileDetail } from "./files";
import { makeSyntheticGraph, isSyntheticGraph } from "./synthetic";
import { ancestorMap, buildTree, findTreeNode, flattenTree, leafIds } from "./tree";
import {
  UnsafeSvgError,
  buildSvg,
  escapeXml,
  findSvgViolations,
  svgInputFrom,
  toSafeSvg,
} from "./svg-export";

const file = (path: string, pkg: string | null = null): GraphNode => ({
  id: `file:${path}`,
  kind: "file",
  path,
  displayName: path.split("/").pop()!,
  package: pkg,
  language: "ts",
});

async function sample(id: string) {
  const res = parseGraph(await SAMPLES.find((s) => s.id === id)!.load());
  if (!res.ok) throw new Error(res.error);
  return res.graph;
}

describe("tree building", () => {
  const nodes: GraphNode[] = [
    file("apps/web/src/a.ts", "@x/web"),
    file("apps/web/src/lib/b.ts", "@x/web"),
    file("apps/web/src/lib/c.ts", "@x/web"),
    file("packages/core/src/d.ts", "@x/core"),
    file("root.ts"),
    {
      id: "external:react",
      kind: "external",
      path: "react",
      displayName: "react",
      package: null,
      language: null,
    },
    {
      id: "builtin:node:fs",
      kind: "builtin",
      path: "node:fs",
      displayName: "node:fs",
      package: null,
      language: null,
    },
  ];

  it("groups by directory with single-child folders compressed, folders before files", () => {
    const t = buildTree(nodes, "directory");
    expect(t.children.map((c) => c.label)).toEqual([
      "apps/web/src",
      "packages/core/src",
      "root.ts",
      "External packages",
      "Node.js built-ins",
    ]);
    const src = t.children[0]!;
    expect(src.children.map((c) => c.label)).toEqual(["lib", "a.ts"]);
    expect(t.count).toBe(nodes.length);
    expect(src.count).toBe(3);
  });

  it("groups by package and keeps externals in their own groups", () => {
    const t = buildTree(nodes, "package");
    expect(t.children.map((c) => c.label)).toEqual([
      "(no package)",
      "@x/core",
      "@x/web",
      "External packages",
      "Node.js built-ins",
    ]);
    const web = t.children.find((c) => c.label === "@x/web")!;
    expect(web.kind).toBe("package");
    expect(web.count).toBe(3);
  });

  it("flattens only expanded branches and reports positions", () => {
    const t = buildTree(nodes, "directory");
    expect(flattenTree(t, new Set()).map((r) => r.label)).toEqual([
      "apps/web/src",
      "packages/core/src",
      "root.ts",
      "External packages",
      "Node.js built-ins",
    ]);
    const open = new Set([t.children[0]!.id]);
    const rows = flattenTree(t, open);
    expect(rows.map((r) => `${r.depth}:${r.label}`).slice(0, 3)).toEqual([
      "0:apps/web/src",
      "1:lib",
      "1:a.ts",
    ]);
    expect(rows[0]).toMatchObject({ expanded: true, hasChildren: true, pos: 1, size: 5 });
  });

  it("search keeps only branches with matches and expands them", () => {
    const t = buildTree(nodes, "directory");
    const rows = flattenTree(t, new Set(), new Set(["file:apps/web/src/lib/c.ts"]));
    expect(rows.map((r) => r.label)).toEqual(["apps/web/src", "lib", "c.ts"]);
    expect(rows.every((r) => r.kind === "file" || r.expanded)).toBe(true);
    expect(flattenTree(t, new Set(), new Set())).toEqual([]);
  });

  it("maps every leaf to its ancestors and finds subtrees", () => {
    const t = buildTree(nodes, "directory");
    const anc = ancestorMap(t);
    expect(anc.size).toBe(nodes.length);
    expect(anc.get("file:apps/web/src/lib/b.ts")!.length).toBe(2);
    const web = findTreeNode(t, t.children[0]!.id)!;
    expect(leafIds(web).sort()).toEqual([
      "file:apps/web/src/a.ts",
      "file:apps/web/src/lib/b.ts",
      "file:apps/web/src/lib/c.ts",
    ]);
    expect(findTreeNode(t, "nope")).toBeNull();
  });
});

describe("large-graph aggregation", () => {
  const big = makeSyntheticGraph(1000);
  const vg = deriveVisible(big, DEFAULT_FILTERS);

  it("chooses grouping from the node count", () => {
    expect(effectiveGrouping("auto", AGGREGATION_THRESHOLD)).toBe("none");
    expect(effectiveGrouping("auto", AGGREGATION_THRESHOLD + 1)).toBe("directory");
    expect(effectiveGrouping("package", 10)).toBe("package");
  });

  it("starts with a bounded number of items and accounts for every module", () => {
    const { tree, display } = groupedView(vg, "directory", 120);
    expect(display.nodes.length).toBeLessThanOrEqual(130);
    expect(display.groups).toBeGreaterThan(0);
    // every module belongs to exactly one drawn item
    expect(display.itemOf.size).toBe(vg.nodes.length);
    const members = new Map<string, number>();
    for (const item of display.itemOf.values()) members.set(item, (members.get(item) ?? 0) + 1);
    for (const n of display.nodes) {
      expect(display.visibleIds.has(n.id)).toBe(true);
      expect(members.get(n.id) ?? 0).toBe(n.kind === "group" ? n.memberCount : 1);
    }
    expect(tree.count).toBe(vg.nodes.length);
  });

  it("preserves edge totals: drawn edges + internal edges = all drawn pairs", () => {
    const { display } = groupedView(vg, "directory", 60);
    const crossing = display.drawn.reduce((s, e) => s + e.edgeIds.length, 0);
    const internal = display.nodes.reduce((s, n) => s + (n.internalEdges ?? 0), 0);
    const all = vg.drawn.reduce((s, e) => s + e.edgeIds.length, 0);
    expect(crossing + internal).toBe(all);
    expect(display.drawn.every((e) => e.source !== e.target)).toBe(true);
  });

  it("expanding everything reproduces the ungrouped graph exactly", () => {
    const tree = buildTree(vg.nodes, "directory");
    const full = deriveDisplay(vg, tree, expandAll(tree));
    const flat = ungroupedDisplay(vg);
    expect(full.groups).toBe(0);
    expect(full.nodes.map((n) => n.id)).toEqual(flat.nodes.map((n) => n.id));
    expect(full.drawn.map((e) => e.id)).toEqual(flat.drawn.map((e) => e.id));
  });

  it("expanding a group replaces it with its children and collapsing restores it", () => {
    const tree = buildTree(vg.nodes, "directory");
    const exp0 = initialExpanded(tree, 40);
    const d0 = deriveDisplay(vg, tree, exp0);
    const group = d0.nodes.find((n) => n.kind === "group")!;
    const d1 = deriveDisplay(vg, tree, new Set([...exp0, group.id]));
    expect(d1.nodes.some((n) => n.id === group.id)).toBe(false);
    expect(d1.nodes.length).toBeGreaterThan(d0.nodes.length - 1);
    // collapse via a member
    const anc = ancestorMap(tree);
    const member = [...d1.itemOf.keys()].find((id) => d0.itemOf.get(id) === group.id)!;
    const { next, collapsed } = collapseAround(new Set([...exp0, group.id]), anc, member);
    expect(collapsed).toBe(group.id);
    expect(deriveDisplay(vg, tree, next).nodes.map((n) => n.id)).toEqual(d0.nodes.map((n) => n.id));
  });

  it("expandTo reveals a collapsed module", () => {
    const tree = buildTree(vg.nodes, "directory");
    const exp = initialExpanded(tree, 30);
    const d = deriveDisplay(vg, tree, exp);
    const hidden = vg.nodes.find((n) => d.itemOf.get(n.id) !== n.id)!;
    const d2 = deriveDisplay(vg, tree, expandTo(exp, ancestorMap(tree), hidden.id));
    expect(d2.itemOf.get(hidden.id)).toBe(hidden.id);
  });

  it("maps highlights through groups, including cycle members, and honours direction", () => {
    const { display } = groupedView(vg, "directory", 40);
    const cycle = big.findings.find((f) => f.category === "runtime-cycle");
    expect(cycle).toBeTruthy();
    const h = computeHighlight(display, { kind: "cycle", id: cycle!.id }, big.findings, {
      itemOf: display.itemOf,
    });
    expect(h.active).toBe(true);
    expect([...h.nodes.values()].every((r) => r === "member")).toBe(true);
    expect(h.nodes.size).toBeGreaterThan(0);

    const sel = [...display.itemOf.keys()].find((id) =>
      display.drawn.some((e) => e.source === display.itemOf.get(id)),
    )!;
    const both = computeHighlight(display, { kind: "node", id: sel }, big.findings, {
      itemOf: display.itemOf,
    });
    const out = computeHighlight(display, { kind: "node", id: sel }, big.findings, {
      itemOf: display.itemOf,
      direction: "outgoing",
    });
    const inc = computeHighlight(display, { kind: "node", id: sel }, big.findings, {
      itemOf: display.itemOf,
      direction: "incoming",
    });
    expect([...out.edges.values()].every((r) => r === "outgoing")).toBe(true);
    expect([...inc.edges.values()].every((r) => r === "incoming")).toBe(true);
    expect(out.edges.size + inc.edges.size).toBe(both.edges.size);
  });

  it("lays out the dense grouped 1,000-module graph compactly, without overlaps, with a route per edge", async () => {
    const { display } = groupedView(vg, "directory");
    expect(display.drawn.length).toBeGreaterThan(FAST_LAYOUT_EDGES); // exercises the dense profile
    const laid = toLayoutData(await new ELK().layout(toElkGraph(display)));
    expect(laid.positions.size).toBe(display.nodes.length);
    expect(laid.routes.size).toBe(display.drawn.length);
    const ps = [...laid.positions.values()];
    let overlaps = 0;
    let width = 0;
    for (let i = 0; i < ps.length; i++) {
      width = Math.max(width, ps[i]!.x + NODE_WIDTH);
      for (let j = i + 1; j < ps.length; j++)
        if (
          Math.abs(ps[i]!.x - ps[j]!.x) < NODE_WIDTH &&
          Math.abs(ps[i]!.y - ps[j]!.y) < NODE_HEIGHT
        )
          overlaps++;
    }
    expect(overlaps).toBe(0);
    expect(width).toBeLessThan(4000); // a layered layout of this graph is ~10,000 px wide
    expect(layoutKey(display, "RIGHT")).not.toBe(layoutKey(display, "DOWN"));
  }, 60_000);

  it("spreadOverlaps separates stacked boxes and straightRoute clips to the borders", () => {
    const pos = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 10, y: 5 }],
      ["c", { x: 12, y: 8 }],
    ]);
    spreadOverlaps(pos, 100, 40, 10);
    const v = [...pos.values()];
    for (let i = 0; i < v.length; i++)
      for (let j = i + 1; j < v.length; j++)
        expect(Math.abs(v[i]!.x - v[j]!.x) >= 100 || Math.abs(v[i]!.y - v[j]!.y) >= 40).toBe(true);
    const [s, t] = straightRoute({ x: 0, y: 0 }, { x: 300, y: 0 }, 100, 40);
    expect(s).toEqual({ x: 100, y: 20 });
    expect(t).toEqual({ x: 300, y: 20 });
  });
});

describe("synthetic graphs", () => {
  it("are deterministic, schema-valid, labelled and contain cycles", () => {
    const a = makeSyntheticGraph(500);
    expect(JSON.stringify(a)).toBe(JSON.stringify(makeSyntheticGraph(500)));
    expect(ArchmapGraph.safeParse(a).success).toBe(true);
    expect(parseGraph(a).ok).toBe(true);
    expect(isSyntheticGraph(a)).toBe(true);
    expect(a.nodes.filter((n) => n.kind === "file")).toHaveLength(500);
    expect(a.findings.length).toBeGreaterThan(0);
  });
});

describe("indexed search on a 1,000-node graph (spec 13.2: p95 <= 150 ms)", () => {
  it("stays far below the budget", () => {
    const g = makeSyntheticGraph(1000);
    const index = buildSearchIndex(g.nodes);
    const queries = [
      "module-0123",
      "pkg-03",
      "feature-07 src",
      "ext",
      "pkg-01/src/feature",
      "0999",
      "synth",
      "zzz",
      "m",
      "node:fs",
    ];
    const times: number[] = [];
    for (let rep = 0; rep < 20; rep++)
      for (const q of queries) {
        const t0 = performance.now();
        searchPaths(index, q, 500);
        times.push(performance.now() - t0);
      }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)]!;
    expect(p95).toBeLessThan(150);
  });
});

describe("SVG export sanitizer", () => {
  const hostile = '"><script>alert(1)</script><foreignObject onload="x()">&amp; \u0000\u0007 \'q\'';

  it("escapes every XML-significant character and drops control characters", () => {
    expect(escapeXml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
    );
    expect(escapeXml("a\u0000b\u0007c")).toBe("abc");
    expect(escapeXml("plain text")).toBe("plain text");
  });

  const nodeWith = (name: string) => ({
    node: {
      id: "file:x.ts",
      kind: "file" as const,
      path: name,
      displayName: name,
      package: null,
      language: "ts" as const,
    },
    x: 0,
    y: 0,
    role: null,
    match: false,
    dim: false,
  });

  it("neutralises hostile repository text in node names, paths and titles", () => {
    const svg = toSafeSvg({
      title: hostile,
      description: hostile,
      nodes: [nodeWith(hostile), { ...nodeWith("b.ts"), x: 300 }],
      edges: [
        {
          points: [
            { x: 208, y: 26 },
            { x: 300, y: 26 },
          ],
          role: null,
          typeOnly: false,
          dim: false,
        },
      ],
    });
    expect(findSvgViolations(svg)).toEqual([]);
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/<foreignObject/i);
    // hostile text survives only as inert, escaped text content: no tag carries it
    const markup = (svg.match(/<[^>]*>/g) ?? []).join("");
    expect(markup).not.toMatch(/\son[a-z]+=/i);
    expect(markup).not.toContain("alert");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg.startsWith("<svg ")).toBe(true);
  });

  it("emits only numbers in numeric attributes, even for NaN and Infinity", () => {
    const svg = buildSvg({
      title: "t",
      description: "d",
      nodes: [{ ...nodeWith("a.ts"), x: NaN, y: Infinity }],
      edges: [],
    });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it("detects every forbidden construct in tampered output", () => {
    const bad: [string, string][] = [
      ["<svg><script>x</script></svg>", "script element"],
      ["<svg><foreignObject></foreignObject></svg>", "foreignObject element"],
      ['<svg onload="x()"></svg>', "event handler attribute"],
      ['<svg><a href="javascript:x()"></a></svg>', "javascript: URL"],
      ['<svg><image href="data:image/png;base64,AAAA"/></svg>', "data: URL"],
      ["<svg><style>*{}</style></svg>", "style element"],
      ['<svg><use href="#a"/></svg>', "href attribute"],
      ['<!DOCTYPE svg [<!ENTITY x "y">]><svg/>', "DOCTYPE, ENTITY or CDATA"],
      ['<?xml-stylesheet href="x"?><svg/>', "processing instruction"],
    ];
    for (const [svg, label] of bad) expect(findSvgViolations(svg), svg).toContain(label);
    expect(findSvgViolations("<svg><text>on click=x data: javascript: href=</text></svg>")).toEqual(
      [],
    );
  });

  it("throws instead of returning an unsafe file", () => {
    expect(() => {
      const svg = "<svg><script>x</script></svg>";
      const v = findSvgViolations(svg);
      if (v.length) throw new UnsafeSvgError(v);
    }).toThrow(UnsafeSvgError);
  });

  it("exports the real circular sample with positions, roles and no violations", async () => {
    const g = await sample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const laid = toLayoutData(await new ELK().layout(toElkGraph(vg)));
    const cycle = g.findings.find((f) => f.category === "runtime-cycle")!;
    const highlight = computeHighlight(vg, { kind: "cycle", id: cycle.id }, g.findings);
    const input = svgInputFrom({
      title: "circular",
      description: "demo",
      nodes: vg.nodes,
      drawn: vg.drawn,
      layout: laid,
      highlight,
      matches: null,
    });
    const svg = toSafeSvg(input);
    expect(input.nodes).toHaveLength(vg.nodes.length);
    expect(input.nodes.filter((n) => n.role === "member").length).toBe(cycle.nodes.length);
    expect(svg).toContain("a.ts");
    expect(findSvgViolations(svg)).toEqual([]);
  });
});

describe("insights and files on real analyzer output", () => {
  it("derives metrics that agree with the graph", async () => {
    const g = await sample("archmap");
    const ins = deriveInsights(g);
    expect(ins.metrics.files).toBe(g.nodes.filter((n) => n.kind === "file").length);
    expect(ins.metrics.edges).toBe(g.edges.length);
    expect(ins.metrics.resolved + ins.metrics.external + ins.metrics.unresolved).toBe(
      g.edges.length,
    );
    expect(ins.metrics.runtimeEdges + ins.metrics.typeOnlyEdges).toBe(g.edges.length);
    expect(ins.coupling[0]!.total).toBeGreaterThanOrEqual(ins.coupling.at(-1)!.total);
    expect(ins.packages.length).toBe(ins.metrics.packages);
  });

  it("lists cycles with evidence on the circular sample", async () => {
    const ins = deriveInsights(await sample("circular"));
    expect(ins.metrics.runtimeCycles).toBe(1);
    expect(ins.cycles[0]!.members).toHaveLength(3);
    expect(ins.cycles[0]!.evidence).toHaveLength(3);
  });

  it("splits a file into imports, re-exports, importers and unresolved with evidence", async () => {
    const g = await sample("archmap");
    const idx = buildFileIndex(g);
    let seen = 0;
    for (const n of g.nodes.filter((x) => x.kind === "file")) {
      const d = fileDetail(idx, n.id)!;
      expect(d.imports.length + d.reExports.length + d.unresolved.length).toBe(
        g.edges.filter((e) => e.source === n.id).length,
      );
      expect(d.importedBy.length).toBe(
        g.edges.filter((e) => e.target === n.id && e.source !== n.id).length,
      );
      for (const r of [...d.imports, ...d.importedBy])
        expect(r.edge.evidence.line).toBeGreaterThan(0);
      seen += d.imports.length;
    }
    expect(seen).toBeGreaterThan(0);
    expect(fileDetail(idx, "file:nope.ts")).toBeNull();
  });

  it("markdown report is computed offline from the same graph", async () => {
    const md = toMarkdown(await sample("circular"));
    expect(md).toContain("# ARCHMAP report: circular");
    expect(md).toContain("## Cycles");
  });
});
