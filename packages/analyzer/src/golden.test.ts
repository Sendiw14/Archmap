import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ArchmapGraph } from "@archmap/graph-schema";
import { analyze } from "./index.ts";

const FIXTURES = path.resolve(import.meta.dirname, "../../../fixtures");

interface Expected {
  status: string;
  edges: [string, string | null, string, string, string][];
  findings: string[];
  diagnostics: string[];
  cycles?: string[][];
  packages?: Record<string, string>;
}

const fixtures = fs
  .readdirSync(FIXTURES)
  .filter((d) => fs.existsSync(path.join(FIXTURES, d, "expected.json")));

describe("golden fixtures", () => {
  it("covers every fixture directory", () => {
    expect(fixtures.length).toBe(fs.readdirSync(FIXTURES).length);
  });

  for (const name of fixtures) {
    it(name, () => {
      const dir = path.join(FIXTURES, name);
      const expected: Expected = JSON.parse(
        fs.readFileSync(path.join(dir, "expected.json"), "utf8"),
      );
      const { graph } = analyze(dir, { reproducible: true, exclude: ["expected.json"] });

      expect(() => ArchmapGraph.parse(graph)).not.toThrow();
      expect(graph.metadata.status).toBe(expected.status);

      const edges = graph.edges
        .map((e) => [
          e.source.replace(/^file:/, ""),
          e.target,
          e.importKind,
          e.dependencyClass,
          e.resolution,
        ])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      const want = [...expected.edges].sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
      );
      expect(edges).toEqual(want);

      expect(graph.findings.map((f) => f.category).sort()).toEqual([...expected.findings].sort());
      expect(graph.diagnostics.map((d) => d.code).sort()).toEqual([...expected.diagnostics].sort());
      if (expected.cycles)
        expect(
          graph.findings.filter((f) => f.category.endsWith("cycle")).map((f) => f.nodes),
        ).toEqual(expected.cycles);
      for (const [file, pkg] of Object.entries(expected.packages ?? {}))
        expect(graph.nodes.find((n) => n.id === `file:${file}`)?.package).toBe(pkg);

      // Evidence must point at a real line in the real file.
      for (const e of graph.edges) {
        const lines = fs.readFileSync(path.join(dir, e.evidence.file), "utf8").split("\n");
        expect(lines[e.evidence.line - 1]).toBeDefined();
        expect(lines[e.evidence.line - 1]).toContain(e.specifier);
      }
      // Cycle evidence edges must connect cycle members.
      for (const f of graph.findings.filter((x) => x.category.endsWith("cycle"))) {
        expect(f.evidence.length).toBeGreaterThan(0);
        for (const id of f.evidence) {
          const e = graph.edges.find((x) => x.id === id)!;
          expect(f.nodes).toContain(e.source);
          expect(f.nodes).toContain(e.target);
        }
      }
    });
  }

  it("is deterministic across runs", () => {
    for (const name of fixtures) {
      const dir = path.join(FIXTURES, name);
      const a = JSON.stringify(analyze(dir, { reproducible: true }).graph);
      const b = JSON.stringify(analyze(dir, { reproducible: true }).graph);
      expect(a).toBe(b);
    }
  });

  it("rejects a missing root", () => {
    expect(() => analyze(path.join(FIXTURES, "does-not-exist"))).toThrow(/Not a directory/);
  });
});
