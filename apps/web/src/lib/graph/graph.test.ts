import { describe, expect, it } from "vitest";
import type { ArchmapGraph } from "@archmap/graph-schema";
import { buildIndex, dependencyPath, findCycles } from "@archmap/graph-core";
import { parseGraph } from "./load";
import { SAMPLES } from "./samples";
import {
  computeHighlight,
  cycleItems,
  DEFAULT_FILTERS,
  deriveVisible,
  inspectNode,
  moduleRows,
  mostImportedFile,
  NO_HIGHLIGHT,
  type VisibleGraph,
} from "./model";
import { buildSearchIndex, mergeRanges, searchPaths } from "./search";
import { buildImpactIndex, IMPACT_DISCLAIMER, impactView } from "./impact";
import { toFlowElements } from "./flow";
import {
  layoutKey,
  NODE_HEIGHT,
  NODE_WIDTH,
  toElkGraph,
  toLayoutData,
  type LayoutData,
} from "./layout-input";
import { roundedPath } from "./route";

async function loadSample(id: string): Promise<ArchmapGraph> {
  const sample = SAMPLES.find((s) => s.id === id)!;
  const res = parseGraph(await sample.load());
  if (!res.ok) throw new Error(res.error);
  return res.graph;
}

describe("demo data", () => {
  it("every sample is real analyzer output that passes the ArchmapGraph schema", async () => {
    for (const s of SAMPLES) {
      const res = parseGraph(await s.load());
      expect(res.ok, s.id).toBe(true);
      if (res.ok) {
        expect(res.graph.metadata.generatedAt, `${s.id} reproducible`).toBeNull();
        expect(res.graph.metadata.analyzerVersion).toBeTruthy();
      }
    }
  });

  it("rejects invalid input and dangling edges", async () => {
    expect(parseGraph({ nodes: [] }).ok).toBe(false);
    expect(parseGraph(null).ok).toBe(false);
    const g = structuredClone(await loadSample("circular"));
    g.edges[0]!.target = "file:missing.ts";
    const res = parseGraph(g);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("unknown node");
  });
});

describe("visibility filters", () => {
  it("hides external/builtin nodes and their edges", async () => {
    const g = await loadSample("archmap");
    const all = deriveVisible(g, DEFAULT_FILTERS);
    const files = deriveVisible(g, { ...DEFAULT_FILTERS, showExternals: false });
    expect(files.nodes.every((n) => n.kind === "file")).toBe(true);
    expect(files.nodes.length).toBe(g.nodes.filter((n) => n.kind === "file").length);
    expect(files.hidden.externalEdges).toBeGreaterThan(0);
    expect(all.nodes.length).toBe(g.nodes.length);
    expect(
      files.drawn.every((e) => files.visibleIds.has(e.source) && files.visibleIds.has(e.target)),
    ).toBe(true);
  });

  it("hides type-only edges (type-cycle sample: a -> b is type-only, b -> a is runtime)", async () => {
    const g = await loadSample("type-cycle");
    expect(deriveVisible(g, DEFAULT_FILTERS).drawn).toHaveLength(2);
    const vg = deriveVisible(g, { ...DEFAULT_FILTERS, showTypeOnly: false });
    expect(vg.drawn.map((e) => e.id)).toEqual(["file:b.ts>>file:a.ts"]);
    expect(vg.hidden.typeOnlyEdges).toBe(1);
  });

  it("never draws unresolved edges but lists them", () => {
    const g = structuredClone(ARCH_STUB);
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    expect(vg.unresolved).toHaveLength(1);
    expect(vg.drawn.some((e) => e.target === null)).toBe(false);
    expect(vg.edges.some((e) => e.target === null)).toBe(false);
  });
});

describe("node highlight and inspection", () => {
  it("highlights incoming and outgoing edges of the selection (circular)", async () => {
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const h = computeHighlight(vg, { kind: "node", id: "file:a.ts" }, g.findings);
    // ring a->b->c->a, plus d->a
    expect(h.nodes.get("file:a.ts")).toBe("selected");
    expect(h.nodes.get("file:b.ts")).toBe("dependency");
    expect(h.nodes.get("file:c.ts")).toBe("dependent");
    expect(h.nodes.get("file:d.ts")).toBe("dependent");
    expect([...h.edges.values()].sort()).toEqual(["incoming", "incoming", "outgoing"]);
    const b = computeHighlight(vg, { kind: "node", id: "file:b.ts" }, g.findings);
    expect(b.nodes.has("file:d.ts")).toBe(false);
  });

  it("highlight sets agree with raw edges on the real self-analysis", async () => {
    const g = await loadSample("archmap");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    for (const n of vg.nodes) {
      const h = computeHighlight(vg, { kind: "node", id: n.id }, g.findings);
      const out = new Set(vg.drawn.filter((e) => e.source === n.id).map((e) => e.target));
      const inc = new Set(vg.drawn.filter((e) => e.target === n.id).map((e) => e.source));
      for (const id of out) expect(["dependency", "both"]).toContain(h.nodes.get(id));
      for (const id of inc) expect(["dependent", "both"]).toContain(h.nodes.get(id));
      expect(h.nodes.size).toBe(new Set([n.id, ...out, ...inc]).size);
    }
  });

  it("returns no highlight for no or unknown focus", async () => {
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    expect(computeHighlight(vg, null, g.findings)).toBe(NO_HIGHLIGHT);
    expect(computeHighlight(vg, { kind: "node", id: "nope" }, g.findings)).toBe(NO_HIGHLIGHT);
    expect(computeHighlight(vg, { kind: "cycle", id: "nope" }, g.findings)).toBe(NO_HIGHLIGHT);
  });

  it("inspection carries file:line:column evidence and snippet text for every edge", async () => {
    const g = await loadSample("archmap");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    let rows = 0;
    for (const n of vg.nodes) {
      const ins = inspectNode(g, vg, n.id)!;
      for (const grp of [...ins.outgoing, ...ins.incoming]) {
        expect(grp.evidence.length).toBeGreaterThan(0);
        for (const ev of grp.evidence) {
          expect(ev.location).toMatch(/^.+:\d+:\d+$/);
          expect(ev.text.length).toBeGreaterThan(0);
          rows++;
        }
      }
      // every edge in the graph shows up as outgoing evidence of its source exactly once
      const outCount = ins.outgoing.reduce((a, x) => a + x.evidence.length, 0);
      expect(outCount).toBe(vg.edges.filter((e) => e.source === n.id).length);
    }
    expect(rows).toBeGreaterThan(0);
  });

  it("lists findings that involve the node", async () => {
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    expect(inspectNode(g, vg, "file:a.ts")!.findings.map((f) => f.category)).toEqual([
      "runtime-cycle",
    ]);
    expect(inspectNode(g, vg, "file:d.ts")!.findings).toEqual([]);
    expect(inspectNode(g, vg, "missing")).toBeNull();
  });
});

describe("cycle investigation", () => {
  it("lists runtime and type-only cycles with members and evidence", async () => {
    const c = cycleItems(await loadSample("circular"));
    expect(c).toHaveLength(1);
    expect(c[0]!.kind).toBe("runtime");
    expect(c[0]!.members.map((m) => m.path)).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(c[0]!.evidence).toHaveLength(3);
    expect(c[0]!.usesTypeOnly).toBe(false);

    const t = cycleItems(await loadSample("type-cycle"));
    expect(t).toHaveLength(1);
    expect(t[0]!.kind).toBe("type-only");
    expect(t[0]!.usesTypeOnly).toBe(true);
  });

  it("hotspot and unresolved findings are not listed as cycles", async () => {
    const g = await loadSample("archmap");
    const expected = g.findings.filter(
      (f) => f.category === "runtime-cycle" || f.category === "type-cycle",
    );
    expect(cycleItems(g).map((c) => c.id)).toEqual(expected.map((f) => f.id));
    expect(g.findings.some((f) => f.category === "hotspot")).toBe(true);
  });

  it("clicking a cycle highlights its members and evidence edges only", async () => {
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const f = g.findings[0]!;
    const h = computeHighlight(vg, { kind: "cycle", id: f.id }, g.findings);
    expect([...h.nodes.keys()].sort()).toEqual(f.nodes);
    expect(h.nodes.has("file:d.ts")).toBe(false);
    expect(h.edges.size).toBe(3);
    expect([...h.edges.values()].every((r) => r === "cycle")).toBe(true);
  });

  it("agrees with graph-core's own cycle detection", async () => {
    for (const id of ["circular", "type-cycle", "archmap"]) {
      const g = await loadSample(id);
      const fromCore = findCycles(buildIndex(g)).map((c) => c.join(","));
      const fromFindings = g.findings
        .filter((f) => f.category === "runtime-cycle" || f.category === "type-cycle")
        .map((f) => f.nodes.join(","));
      expect(fromFindings.sort()).toEqual(fromCore.sort());
    }
  });
});

describe("potential change impact", () => {
  it("direct dependents equal the importers in the raw edge list (real data)", async () => {
    const g = await loadSample("archmap");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const index = buildImpactIndex(g, DEFAULT_FILTERS);
    for (const n of vg.nodes) {
      const v = impactView(index, vg, n.id);
      const importers = new Set(
        g.edges.filter((e) => e.target === n.id && e.source !== n.id).map((e) => e.source),
      );
      expect(new Set(v.direct.map((r) => r.id))).toEqual(importers);
      expect(v.total).toBe(v.direct.length + v.indirect.length);
      expect(v.direct.every((r) => r.depth === 1)).toBe(true);
      expect(v.indirect.every((r) => r.depth >= 2)).toBe(true);
    }
  });

  it("every dependent's chain is a real import path ending at the selection", async () => {
    const g = await loadSample("archmap");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const index = buildImpactIndex(g, DEFAULT_FILTERS);
    const id = mostImportedFile(vg)!;
    const v = impactView(index, vg, id);
    expect(v.direct.length).toBeGreaterThan(0);
    for (const r of [...v.direct, ...v.indirect]) {
      expect(r.chain[0]).toBe(r.path);
      expect(r.chain[r.chain.length - 1]).toBe(vg.nodeById.get(id)!.path);
      expect(dependencyPath(index, r.id, id)!.length - 1).toBe(r.depth);
    }
  });

  it("circular sample: transitive dependents through the ring", async () => {
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const v = impactView(buildImpactIndex(g, DEFAULT_FILTERS), vg, "file:a.ts");
    expect(v.direct.map((r) => r.path)).toEqual(["c.ts", "d.ts"]);
    expect(v.indirect.map((r) => r.path)).toEqual(["b.ts"]);
    expect(v.indirect[0]!.chain).toEqual(["b.ts", "c.ts", "a.ts"]);
    // nothing imports d.ts
    expect(impactView(buildImpactIndex(g, DEFAULT_FILTERS), vg, "file:d.ts").total).toBe(0);
  });

  it("monorepo sample reports affected packages", async () => {
    const g = await loadSample("monorepo");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const v = impactView(
      buildImpactIndex(g, DEFAULT_FILTERS),
      vg,
      "file:packages/core/src/index.ts",
    );
    expect(v.packages).toContain("@mono/app");
  });

  it("respects the type-only filter", async () => {
    const g = await loadSample("type-cycle");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    // a imports b through a type-only import
    expect(impactView(buildImpactIndex(g, DEFAULT_FILTERS), vg, "file:b.ts").total).toBe(1);
    expect(
      impactView(buildImpactIndex(g, { ...DEFAULT_FILTERS, showTypeOnly: false }), vg, "file:b.ts")
        .total,
    ).toBe(0);
  });

  it("never claims dependents will break", () => {
    expect(IMPACT_DISCLAIMER).toMatch(/does not mean they will break/);
    expect(IMPACT_DISCLAIMER).not.toMatch(/will break\./);
  });
});

describe("search", () => {
  it("ranks basename prefix matches first and reports highlight ranges", async () => {
    const g = await loadSample("archmap");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const idx = buildSearchIndex(vg.nodes);
    const hits = searchPaths(idx, "graph");
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.path.toLowerCase()).toContain("graph");
      for (const [s, e] of h.ranges) expect(h.path.slice(s, e).toLowerCase()).toBe("graph");
    }
  });

  it("supports multiple tokens, is case-insensitive, and returns [] for empty queries", async () => {
    const g = await loadSample("monorepo");
    const idx = buildSearchIndex(deriveVisible(g, DEFAULT_FILTERS).nodes);
    expect(searchPaths(idx, "CORE index").map((h) => h.path)).toEqual([
      "packages/core/src/index.ts",
    ]);
    expect(searchPaths(idx, "   ")).toEqual([]);
    expect(searchPaths(idx, "zzzz-no-match")).toEqual([]);
  });

  it("prefers basename matches over directory matches", () => {
    const nodes = [
      {
        id: "1",
        kind: "file",
        path: "util/zzz.ts",
        displayName: "zzz.ts",
        package: null,
        language: "ts",
      },
      {
        id: "2",
        kind: "file",
        path: "zzz/readme.ts",
        displayName: "readme.ts",
        package: null,
        language: "ts",
      },
    ] as const;
    const hits = searchPaths(buildSearchIndex([...nodes]), "zzz");
    expect(hits.map((h) => h.id)).toEqual(["1", "2"]);
  });

  it("merges overlapping ranges", () => {
    expect(
      mergeRanges([
        [0, 3],
        [2, 5],
        [7, 8],
      ]),
    ).toEqual([
      [0, 5],
      [7, 8],
    ]);
  });

  it("indexed search over the largest real demo graph (timing is logged, not asserted)", async () => {
    const graphs = await Promise.all(SAMPLES.map((s) => loadSample(s.id)));
    const largest = graphs.reduce((a, b) => (b.nodes.length > a.nodes.length ? b : a));
    const nodes = deriveVisible(largest, DEFAULT_FILTERS).nodes;
    const t0 = performance.now();
    const idx = buildSearchIndex(nodes);
    const buildMs = performance.now() - t0;
    const queries = ["a", "src", "index", "graph core", "cli", "zzz"];
    const runs = 2000;
    const t1 = performance.now();
    let hits = 0;
    for (let i = 0; i < runs; i++) hits += searchPaths(idx, queries[i % queries.length]!).length;
    const perQueryUs = ((performance.now() - t1) / runs) * 1000;
    console.log(
      `[search bench] ${nodes.length} nodes (largest real demo graph): index build ${buildMs.toFixed(3)} ms, ` +
        `${perQueryUs.toFixed(1)} us/query over ${runs} queries`,
    );
    expect(hits).toBeGreaterThan(0);
  });
});

describe("module list", () => {
  it("rows match visible edges", async () => {
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const rows = moduleRows(vg);
    expect(rows.map((r) => [r.path, r.importCount, r.importedByCount])).toEqual([
      ["a.ts", 1, 2],
      ["b.ts", 1, 1],
      ["c.ts", 1, 1],
      ["d.ts", 1, 0],
    ]);
  });
});

describe("React Flow elements", () => {
  const positions = (vg: VisibleGraph): LayoutData => ({
    positions: new Map(vg.nodes.map((n, i) => [n.id, { x: i * 300, y: 0 }])),
    routes: new Map(),
  });

  it("maps nodes and edges, dashing type-only edges", async () => {
    const g = await loadSample("type-cycle");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const { nodes, edges } = toFlowElements(vg, positions(vg), {
      highlight: NO_HIGHLIGHT,
      matches: null,
      selectedId: null,
    });
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(2);
    expect(edges.filter((e) => e.style?.strokeDasharray).map((e) => e.id)).toEqual([
      "file:a.ts>>file:b.ts",
    ]);
    expect(
      nodes.every(
        (n) => n.width === NODE_WIDTH && n.height === NODE_HEIGHT && n.draggable === false,
      ),
    ).toBe(true);
    expect(nodes.every((n) => !n.data.dim)).toBe(true);
  });

  it("draws runtime edges solid and dims everything outside the highlight", async () => {
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const highlight = computeHighlight(vg, { kind: "node", id: "file:b.ts" }, g.findings);
    const { nodes, edges } = toFlowElements(vg, positions(vg), {
      highlight,
      matches: null,
      selectedId: "file:b.ts",
    });
    expect(edges.every((e) => e.style?.strokeDasharray === undefined)).toBe(true);
    expect(nodes.find((n) => n.id === "file:d.ts")!.data.dim).toBe(true);
    expect(nodes.find((n) => n.id === "file:b.ts")!.selected).toBe(true);
    expect(edges.filter((e) => e.style?.opacity === 1)).toHaveLength(2);
    expect(edges.filter((e) => (e.style?.opacity as number) < 1)).toHaveLength(2);
  });

  it("marks search matches and dims non-matches", async () => {
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const { nodes } = toFlowElements(vg, positions(vg), {
      highlight: NO_HIGHLIGHT,
      matches: new Set(["file:b.ts"]),
      selectedId: null,
    });
    expect(nodes.filter((n) => n.data.match).map((n) => n.id)).toEqual(["file:b.ts"]);
    expect(nodes.filter((n) => n.data.dim)).toHaveLength(3);
  });

  it("exposes an accessible name per node that includes relationships", async () => {
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const { nodes } = toFlowElements(vg, positions(vg), {
      highlight: NO_HIGHLIGHT,
      matches: null,
      selectedId: null,
    });
    expect(nodes[0]!.ariaLabel).toBe("a.ts, file, imports 1 module, imported by 2 modules");
  });

  it("skips nodes that have no layout position yet", async () => {
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const { nodes, edges } = toFlowElements(
      vg,
      { positions: new Map(), routes: new Map() },
      {
        highlight: NO_HIGHLIGHT,
        matches: null,
        selectedId: null,
      },
    );
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});

describe("ELK layout (main thread, same code path as the worker)", () => {
  it("places every node of the largest real graph without overlaps", async () => {
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    const g = await loadSample("archmap");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const t0 = performance.now();
    const laid = await new ELK().layout(toElkGraph(vg));
    console.log(
      `[layout bench] ELK layered, ${vg.nodes.length} nodes / ${vg.drawn.length} edges: ${(performance.now() - t0).toFixed(0)} ms (node, cold)`,
    );
    const { positions: pos, routes } = toLayoutData(laid);
    expect(pos.size).toBe(vg.nodes.length);
    // every drawn edge gets an ELK-routed polyline (this includes cycle-closing back edges)
    expect(routes.size).toBe(vg.drawn.length);
    for (const pts of routes.values()) {
      expect(pts.length).toBeGreaterThanOrEqual(2);
      for (const pt of pts) expect(Number.isFinite(pt.x) && Number.isFinite(pt.y)).toBe(true);
    }
    const rects = [...pos.values()];
    for (const r of rects) expect(Number.isFinite(r.x) && Number.isFinite(r.y)).toBe(true);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!,
          b = rects[j]!;
        const overlap =
          a.x < b.x + NODE_WIDTH &&
          b.x < a.x + NODE_WIDTH &&
          a.y < b.y + NODE_HEIGHT &&
          b.y < a.y + NODE_HEIGHT;
        expect(overlap).toBe(false);
      }
  });

  it("routes the cycle-closing edge of the circular sample", async () => {
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    const g = await loadSample("circular");
    const vg = deriveVisible(g, DEFAULT_FILTERS);
    const { routes } = toLayoutData(await new ELK().layout(toElkGraph(vg)));
    expect([...routes.keys()].sort()).toEqual(vg.drawn.map((e) => e.id).sort());
  });

  it("roundedPath keeps endpoints, rounds corners, and handles degenerate input", () => {
    expect(roundedPath([])).toBe("");
    expect(roundedPath([{ x: 1, y: 2 }])).toBe("M1 2");
    expect(
      roundedPath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe("M0 0 L10 0");
    const d = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
      8,
    );
    expect(d.startsWith("M0 0")).toBe(true);
    expect(d).toContain("Q40 0 40 8");
    expect(d.endsWith("L40 40")).toBe(true);
  });

  it("layoutKey changes only when nodes or drawn edges change", async () => {
    const g = await loadSample("archmap");
    const a = deriveVisible(g, DEFAULT_FILTERS);
    const b = deriveVisible(g, DEFAULT_FILTERS);
    const c = deriveVisible(g, { ...DEFAULT_FILTERS, showExternals: false });
    expect(layoutKey(a)).toBe(layoutKey(b));
    expect(layoutKey(a)).not.toBe(layoutKey(c));
  });
});

/** Minimal graph with one unresolved import (no demo sample contains one). */
const ARCH_STUB: ArchmapGraph = {
  metadata: {
    analysisId: "x",
    schemaVersion: "1.0.0",
    analyzerVersion: "0",
    compilerVersion: "0",
    repository: { name: "stub", commit: null },
    configHash: "0",
    status: "completed",
    generatedAt: null,
    counts: { filesDiscovered: 1, filesAnalyzed: 1, filesExcluded: 0, filesSkipped: 0 },
  },
  nodes: [
    {
      id: "file:a.ts",
      kind: "file",
      path: "a.ts",
      displayName: "a.ts",
      package: null,
      language: "ts",
    },
  ],
  edges: [
    {
      id: "e1",
      source: "file:a.ts",
      target: null,
      specifier: "./missing",
      importKind: "import",
      dependencyClass: "runtime",
      resolution: "unresolved",
      evidence: { file: "a.ts", line: 1, column: 1, text: 'import "./missing";' },
    },
  ],
  findings: [],
  diagnostics: [],
  coverage: {
    supportedConstructs: [],
    importKinds: {},
    resolutions: {},
    unsupportedExpressions: 0,
    filesWithParseErrors: 0,
  },
};
