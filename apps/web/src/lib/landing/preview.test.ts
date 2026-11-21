import { describe, expect, it } from "vitest";
import { parseGraph } from "../graph/load";
import { SAMPLES } from "../graph/samples";
import { buildPreview } from "./preview";

async function g(id: string) {
  const r = parseGraph(await SAMPLES.find((s) => s.id === id)!.load());
  if (!r.ok) throw new Error(r.error);
  return r.graph;
}

describe("landing previews use real demo data", () => {
  it("lays out the real ARCHMAP file graph with positions and routes for every item", async () => {
    const graph = await g("archmap");
    const p = await buildPreview(graph, { showExternals: false });
    expect(p.nodes).toHaveLength(graph.nodes.filter((n) => n.kind === "file").length);
    expect(Object.keys(p.positions)).toHaveLength(p.nodes.length);
    expect(Object.keys(p.routes).length).toBe(p.drawn.length);
    expect(p.width).toBeGreaterThan(200);
    expect(p.counts.imports).toBe(graph.edges.length);
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });

  it("collapses to one node per package", async () => {
    const graph = await g("archmap");
    const p = await buildPreview(graph, { collapseToPackages: true, showExternals: false });
    expect(p.nodes.every((n) => n.kind === "group")).toBe(true);
    expect(p.nodes.length).toBeLessThan(graph.nodes.filter((n) => n.kind === "file").length);
  });

  it("keeps the circular sample's runtime cycle", async () => {
    const p = await buildPreview(await g("circular"));
    expect(p.findings.some((f) => f.category === "runtime-cycle")).toBe(true);
    expect(p.counts.cycles).toBe(1);
  });
});
