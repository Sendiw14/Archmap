import {
  SCHEMA_VERSION,
  type ArchmapGraph,
  type Finding,
  type GraphEdge,
  type GraphNode,
} from "@archmap/graph-schema";
import { buildIndex, findCycles, RULES } from "@archmap/graph-core";

/**
 * Deterministic synthetic repositories for stress tests and benchmarks (spec 13.2).
 * These are NOT analyzer output and are labelled as such everywhere they are shown
 * (analyzerVersion "synthetic-generator"). Shape: layered packages, mostly acyclic imports,
 * a few back edges that form cycles, some externals, built-ins and unresolved imports.
 */

export const SYNTHETIC_ANALYZER = "synthetic-generator";
export const isSyntheticGraph = (g: ArchmapGraph) =>
  g.metadata.analyzerVersion === SYNTHETIC_ANALYZER;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

export function makeSyntheticGraph(fileCount: number, seed = 42): ArchmapGraph {
  const rnd = mulberry32(seed + fileCount);
  const pick = (n: number) => Math.floor(rnd() * n);
  const packages = Math.max(4, Math.round(Math.sqrt(fileCount) / 4));
  const perPackage = Math.ceil(fileCount / packages);
  const dirsPerPackage = Math.max(2, Math.ceil(perPackage / 14));

  const nodes: GraphNode[] = [];
  const byPackage: string[][] = Array.from({ length: packages }, () => []);
  for (let i = 0; i < fileCount; i++) {
    const p = Math.min(packages - 1, Math.floor(i / perPackage));
    const local = i - p * perPackage;
    const dir = `feature-${pad(local % dirsPerPackage, 2)}`;
    const path = `packages/pkg-${pad(p, 2)}/src/${dir}/module-${pad(i, 4)}.ts`;
    const id = `file:${path}`;
    nodes.push({
      id,
      kind: "file",
      path,
      displayName: `module-${pad(i, 4)}.ts`,
      package: `@synth/pkg-${pad(p, 2)}`,
      language: "ts",
    });
    byPackage[p]!.push(id);
  }
  const externals = Array.from(
    { length: Math.min(40, Math.max(6, Math.round(fileCount / 25))) },
    (_, i) => `ext-${pad(i, 2)}`,
  );
  for (const name of externals)
    nodes.push({
      id: `external:${name}`,
      kind: "external",
      path: name,
      displayName: name,
      package: null,
      language: null,
    });
  const builtins = ["fs", "path", "url", "util", "crypto", "events"];
  for (const name of builtins)
    nodes.push({
      id: `builtin:node:${name}`,
      kind: "builtin",
      path: `node:${name}`,
      displayName: `node:${name}`,
      package: null,
      language: null,
    });

  const edges: GraphEdge[] = [];
  const add = (
    source: string,
    target: string | null,
    specifier: string,
    line: number,
    cls: "runtime" | "type-only",
    resolution: GraphEdge["resolution"],
  ) => {
    const column = 1;
    edges.push({
      id: `${source}|import|${specifier}|${line}:${column}`,
      source,
      target,
      specifier,
      importKind: "import",
      dependencyClass: cls,
      resolution,
      evidence: {
        file: source.replace(/^file:/, ""),
        line,
        column,
        text: `import { value } from "${specifier}";`,
      },
      ...(resolution === "unresolved" ? { diagnostic: "Cannot find module" } : {}),
    });
  };
  const seen = new Set<string>();
  const tryAdd = (s: string, t: string, line: number, forceRuntime = false) => {
    if (s === t || seen.has(`${s}>${t}`)) return;
    seen.add(`${s}>${t}`);
    const spec = `./${t.split("/").pop()!.replace(/\.ts$/, "")}`;
    add(s, t, spec, line, !forceRuntime && rnd() < 0.12 ? "type-only" : "runtime", "resolved");
  };

  for (let p = 0; p < packages; p++) {
    const list = byPackage[p]!;
    list.forEach((id, k) => {
      const degree = 2 + pick(4);
      for (let d = 0; d < degree; d++) {
        const roll = rnd();
        if (roll < 0.72 && k > 0) {
          // within the package, towards lower indices (keeps the graph layered)
          tryAdd(id, list[Math.max(0, k - 1 - pick(Math.min(k, 30)))]!, d + 1);
        } else if (roll < 0.9 && p > 0) {
          const lower = byPackage[pick(p)]!;
          tryAdd(id, lower[pick(lower.length)]!, d + 1);
        } else if (roll < 0.97) {
          const ext = externals[pick(externals.length)]!;
          const key = `${id}>ext:${ext}`;
          if (!seen.has(key)) {
            seen.add(key);
            add(id, `external:${ext}`, ext, d + 1, "runtime", "external");
          }
        } else {
          const b = builtins[pick(builtins.length)]!;
          const key = `${id}>b:${b}`;
          if (!seen.has(key)) {
            seen.add(key);
            add(id, `builtin:node:${b}`, `node:${b}`, d + 1, "runtime", "external");
          }
        }
      }
      // rare back edge to a higher index in the same package: closes a cycle
      if (k > 3 && rnd() < 0.01) {
        tryAdd(id, list[k - 2]!, 9, true);
        tryAdd(list[k - 2]!, id, 9, true);
      }
      if (rnd() < 0.01) add(id, null, `./missing-${pad(k, 3)}`, 8, "runtime", "unresolved");
    });
  }
  edges.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const findings: Finding[] = [];
  const fileEdges = edges.filter((e) => e.target?.startsWith("file:"));
  const runtime = buildIndex(
    { nodes: nodes.filter((n) => n.kind === "file"), edges: fileEdges },
    { typeOnly: false },
  );
  for (const [i, c] of findCycles(runtime).entries()) {
    const set = new Set(c);
    findings.push({
      id: `finding:synthetic-cycle-${pad(i, 3)}`,
      category: "runtime-cycle",
      severity: "warning",
      nodes: c,
      evidence: fileEdges
        .filter((e) => e.dependencyClass === "runtime" && set.has(e.source) && set.has(e.target!))
        .map((e) => e.id)
        .sort(),
      explanation: `${c.length} modules form a circular dependency through runtime imports.`,
      rule: RULES.cycle,
    });
  }

  const count = (r: GraphEdge["resolution"]) => edges.filter((e) => e.resolution === r).length;
  return {
    metadata: {
      analysisId: `synthetic-${fileCount}`,
      schemaVersion: SCHEMA_VERSION,
      analyzerVersion: SYNTHETIC_ANALYZER,
      compilerVersion: "none",
      repository: { name: `synthetic-${fileCount}`, commit: null },
      configHash: `seed-${seed}`,
      status: "completed",
      generatedAt: null,
      counts: {
        filesDiscovered: fileCount,
        filesAnalyzed: fileCount,
        filesExcluded: 0,
        filesSkipped: 0,
      },
    },
    nodes,
    edges,
    findings,
    diagnostics: [],
    coverage: {
      supportedConstructs: ["static import declarations (synthetic)"],
      importKinds: { import: edges.length },
      resolutions: {
        resolved: count("resolved"),
        external: count("external"),
        unresolved: count("unresolved"),
      },
      unsupportedExpressions: 0,
      filesWithParseErrors: 0,
    },
  };
}
