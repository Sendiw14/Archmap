import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode } from "@archmap/graph-schema";
import {
  aggregateByPackage,
  buildIndex,
  computeFindings,
  dependencyPath,
  findCycles,
  potentialImpact,
  stronglyConnectedComponents,
} from "./index.ts";

const node = (id: string, pkg: string | null = null): GraphNode => ({
  id,
  kind: "file",
  path: id,
  displayName: id,
  package: pkg,
  language: "ts",
});
const edge = (s: string, t: string, typeOnly = false): GraphEdge => ({
  id: `${s}->${t}`,
  source: s,
  target: t,
  specifier: t,
  importKind: "import",
  dependencyClass: typeOnly ? "type-only" : "runtime",
  resolution: "resolved",
  evidence: { file: s, line: 1, column: 1, text: "" },
});
const graph = (ids: string[], pairs: [string, string, boolean?][]) => ({
  nodes: ids.map((i) => node(i)),
  edges: pairs.map(([s, t, ty]) => edge(s, t, ty)),
});

describe("SCC / cycles", () => {
  it("finds a 3-cycle and ignores acyclic singletons", () => {
    const g = graph(
      ["a", "b", "c", "d"],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
        ["d", "a"],
      ],
    );
    expect(findCycles(buildIndex(g))).toEqual([["a", "b", "c"]]);
    expect(stronglyConnectedComponents(buildIndex(g))).toEqual([["a", "b", "c"], ["d"]]);
  });
  it("distinguishes self-loop from singleton", () => {
    const g = graph(["a", "b"], [["a", "a"]]);
    expect(findCycles(buildIndex(g))).toEqual([["a"]]);
  });
  it("excludes type-only edges when asked", () => {
    const g = graph(
      ["a", "b"],
      [
        ["a", "b", true],
        ["b", "a"],
      ],
    );
    expect(findCycles(buildIndex(g))).toEqual([["a", "b"]]);
    expect(findCycles(buildIndex(g, { typeOnly: false }))).toEqual([]);
  });
  it("handles deep chains without stack overflow", () => {
    const ids = Array.from({ length: 50_000 }, (_, i) => `n${String(i).padStart(6, "0")}`);
    const pairs = ids.slice(1).map((id, i) => [ids[i]!, id] as [string, string]);
    pairs.push([ids.at(-1)!, ids[0]!]);
    expect(findCycles(buildIndex(graph(ids, pairs)))[0]).toHaveLength(50_000);
  });
});

describe("impact and paths", () => {
  const g = graph(
    ["a", "b", "c", "d"],
    [
      ["a", "b"],
      ["b", "c"],
      ["d", "c"],
    ],
  );
  it("computes direct and transitive dependents with paths", () => {
    const r = potentialImpact(buildIndex(g), "c");
    expect(r.direct).toEqual(["b", "d"]);
    expect(r.transitive).toEqual(["a", "b", "d"]);
    expect(r.paths.a).toEqual(["a", "b", "c"]);
  });
  it("finds shortest dependency path in import direction", () => {
    expect(dependencyPath(buildIndex(g), "a", "c")).toEqual(["a", "b", "c"]);
    expect(dependencyPath(buildIndex(g), "c", "a")).toBeNull();
  });
});

describe("package aggregation", () => {
  it("counts cross-package edges only", () => {
    const g = {
      nodes: [node("a", "p1"), node("b", "p1"), node("c", "p2")],
      edges: [edge("a", "b"), edge("a", "c"), edge("b", "c")],
    };
    expect(aggregateByPackage(g)).toEqual([
      { source: "p1", target: "p2", count: 2, edges: ["a->c", "b->c"] },
    ]);
  });
});

describe("computeFindings hotspot rule", () => {
  it("flags a hub above max(8, mean + 2sd) and nothing else", () => {
    const leaves = Array.from({ length: 30 }, (_, i) => `file:l${String(i).padStart(2, "0")}`);
    const g = {
      nodes: ["file:hub", ...leaves].map((i) => node(i)),
      edges: leaves.map((l) => edge(l, "file:hub")),
    };
    const hot = computeFindings(g).filter((f) => f.category === "hotspot");
    expect(hot.map((f) => f.nodes)).toEqual([["file:hub"]]);
    expect(hot[0]!.explanation).toContain("fan-in 30");
  });
  it("never flags graphs below the floor of 8", () => {
    const g = graph(["file:a", "file:b"], [["file:a", "file:b"]]);
    expect(computeFindings(g).filter((f) => f.category === "hotspot")).toEqual([]);
  });
});
