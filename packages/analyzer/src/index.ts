import { createHash } from "node:crypto";
import fs from "node:fs";
import nodePath from "node:path";
import path from "node:path/posix";
import { compilerVersion, createResolver, extractReferences } from "@archmap/compiler-adapter";
import { computeFindings } from "@archmap/graph-core/findings";
import {
  SCHEMA_VERSION,
  type AnalysisStatus,
  type ArchmapGraph,
  type DependencyClass,
  type Diagnostic,
  type GraphEdge,
  type GraphNode,
  type Language,
} from "@archmap/graph-schema";

export { compilerVersion };
export const ANALYZER_VERSION = "0.1.0";

export const SUPPORTED_CONSTRUCTS = [
  "import declarations (default, named, namespace, side-effect)",
  "type-only imports (import type, all-type named imports)",
  "export ... from re-exports (including export * and type-only)",
  "CommonJS require() with a string literal",
  "import x = require('...')",
  "dynamic import() with a string literal",
  "typeof import('...') type references",
  "tsconfig/jsconfig paths, baseUrl, extends (files inside the repository)",
  "package.json exports/imports via TypeScript module resolution",
  "workspace packages (package.json name) including source-entry fallback",
];

export const DEFAULT_IGNORED_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  ".vercel",
];

export interface AnalyzeOptions {
  /** Glob patterns (repository-relative, POSIX) to exclude. */
  exclude?: string[];
  maxFiles?: number;
  maxFileBytes?: number;
  /** Omit generatedAt so output is byte-for-byte reproducible. */
  reproducible?: boolean;
  /** Repository identity supplied by the caller (hosted mode); overrides package.json / .git detection. */
  repository?: { name: string; commit: string | null };
  onProgress?: (phase: string, done: number, total: number) => void;
}

export interface AnalyzeResult {
  graph: ArchmapGraph;
  /** Phase durations in ms (not part of the deterministic graph). */
  timings: Record<string, number>;
}

const SOURCE_RE = /\.(d\.ts|ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const VISIBLE_RE = /\.(d\.ts|ts|tsx|mts|cts|js|jsx|mjs|cjs|json)$/;

const languageOf = (rel: string): Language => {
  if (rel.endsWith(".d.ts") || rel.endsWith(".d.mts") || rel.endsWith(".d.cts")) return "dts";
  return path.extname(rel).slice(1) as Language;
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export class AnalysisError extends Error {}

function readCommit(rootAbs: string): string | null {
  try {
    const gitDir = nodePath.join(rootAbs, ".git");
    const head = fs.readFileSync(nodePath.join(gitDir, "HEAD"), "utf8").trim();
    if (!head.startsWith("ref: ")) return /^[0-9a-f]{40}$/.test(head) ? head : null;
    const ref = head.slice(5);
    const refFile = nodePath.join(gitDir, ...ref.split("/"));
    if (fs.existsSync(refFile)) return fs.readFileSync(refFile, "utf8").trim() || null;
    const packed = fs.readFileSync(nodePath.join(gitDir, "packed-refs"), "utf8");
    const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`));
    return line?.split(" ")[0] ?? null;
  } catch {
    return null;
  }
}

export function analyze(rootInput: string, options: AnalyzeOptions = {}): AnalyzeResult {
  const timings: Record<string, number> = {};
  let t0 = performance.now();
  const mark = (phase: string) => {
    const now = performance.now();
    timings[phase] = Math.round((now - t0) * 100) / 100;
    t0 = now;
  };

  const rootAbs = nodePath.resolve(rootInput);
  if (!fs.existsSync(rootAbs) || !fs.statSync(rootAbs).isDirectory())
    throw new AnalysisError(`Not a directory: ${rootInput}`);
  const root = rootAbs.split(nodePath.sep).join("/");
  const exclude = options.exclude ?? [];
  const maxFiles = options.maxFiles ?? 10_000;
  const maxFileBytes = options.maxFileBytes ?? 2 * 1024 * 1024;
  const diagnostics: Diagnostic[] = [];

  // ---- discovery (never follows symlinks, never leaves root) ----
  const visible = new Set<string>();
  const sources: string[] = [];
  let excluded = 0;
  let skipped = 0;
  let discovered = 0;
  const walk = (relDir: string) => {
    const entries = fs.readdirSync(relDir ? nodePath.join(rootAbs, relDir) : rootAbs, {
      withFileTypes: true,
    });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const ent of entries) {
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      if (ent.isSymbolicLink()) {
        diagnostics.push({
          code: "symlink-skipped",
          severity: "info",
          message: "Symbolic link not followed",
          file: rel,
        });
        skipped++;
        continue;
      }
      if (exclude.some((g) => path.matchesGlob(rel, g))) {
        excluded++;
        continue;
      }
      if (ent.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.includes(ent.name)) continue;
        walk(rel);
      } else if (ent.isFile() && VISIBLE_RE.test(ent.name)) {
        const isSource = SOURCE_RE.test(ent.name);
        if (isSource) discovered++;
        if (fs.statSync(nodePath.join(rootAbs, rel)).size > maxFileBytes) {
          diagnostics.push({
            code: "file-too-large",
            severity: "warning",
            message: `File exceeds ${maxFileBytes} bytes and was not parsed`,
            file: rel,
          });
          skipped++;
          continue;
        }
        if (isSource && sources.length >= maxFiles) {
          skipped++;
          continue;
        }
        visible.add(rel);
        if (isSource) sources.push(rel);
      }
    }
  };
  walk("");
  if (discovered > maxFiles)
    diagnostics.push({
      code: "file-limit",
      severity: "warning",
      message: `Discovered ${discovered} source files; only the first ${maxFiles} were analyzed`,
    });
  mark("scan");

  const readRel = (rel: string) => {
    try {
      return fs.readFileSync(nodePath.join(rootAbs, rel), "utf8");
    } catch {
      return undefined;
    }
  };

  // ---- workspace packages ----
  const workspacePackages = new Map<string, string>();
  const packageDirs = new Map<string, string>(); // dir -> name
  for (const rel of [...visible]
    .filter((f) => f === "package.json" || f.endsWith("/package.json"))
    .sort()) {
    try {
      const pkg = JSON.parse(readRel(rel) ?? "");
      if (typeof pkg?.name === "string") {
        const dir = rel === "package.json" ? "" : path.dirname(rel);
        if (!workspacePackages.has(pkg.name)) workspacePackages.set(pkg.name, dir);
        packageDirs.set(dir, pkg.name);
      }
    } catch {
      diagnostics.push({
        code: "invalid-package-json",
        severity: "warning",
        message: "package.json could not be parsed",
        file: rel,
      });
    }
  }
  const packageOf = (rel: string): string | null => {
    let d = path.dirname(rel);
    for (;;) {
      const key = d === "." ? "" : d;
      if (packageDirs.has(key)) return packageDirs.get(key)!;
      if (key === "") return null;
      d = path.dirname(d);
    }
  };
  const moduleTypeOf = (rel: string): "import" | "require" => {
    if (/\.(mts|mjs)$/.test(rel)) return "import";
    if (/\.(cts|cjs)$/.test(rel)) return "require";
    let d = path.dirname(rel);
    for (;;) {
      const key = d === "." ? "" : d;
      const pj = key ? `${key}/package.json` : "package.json";
      if (visible.has(pj)) {
        try {
          return JSON.parse(readRel(pj) ?? "{}").type === "module" ? "import" : "require";
        } catch {
          return "require";
        }
      }
      if (key === "") return "require";
      d = path.dirname(d);
    }
  };

  const resolver = createResolver({ root, files: visible, readFile: readRel, workspacePackages });

  // ---- extraction + resolution ----
  const nodes = new Map<string, GraphNode>();
  const addFileNode = (rel: string) => {
    const id = `file:${rel}`;
    if (!nodes.has(id))
      nodes.set(id, {
        id,
        kind: "file",
        path: rel,
        displayName: path.basename(rel),
        package: packageOf(rel),
        language: languageOf(rel),
      });
    return id;
  };
  for (const rel of sources) addFileNode(rel);

  const edges: GraphEdge[] = [];
  const seenConfigs = new Set<string>();
  let unsupportedCount = 0;
  let parseErrorFiles = 0;
  let parseMs = 0;
  let resolveMs = 0;

  sources.forEach((rel, i) => {
    options.onProgress?.("analyze", i, sources.length);
    const cfg = resolver.configFor(rel);
    if (cfg.configPath && !seenConfigs.has(cfg.configPath)) {
      seenConfigs.add(cfg.configPath);
      for (const e of cfg.errors)
        diagnostics.push({
          code: "config-error",
          severity: "warning",
          message: e,
          file: cfg.configPath,
        });
    }
    const text = readRel(rel);
    if (text === undefined) {
      diagnostics.push({
        code: "read-failed",
        severity: "error",
        message: "File could not be read",
        file: rel,
      });
      return;
    }
    const p0 = performance.now();
    const { references, unsupported, parseErrors } = extractReferences(rel, text);
    parseMs += performance.now() - p0;
    if (parseErrors.length > 0) {
      parseErrorFiles++;
      diagnostics.push({
        code: "parse-error",
        severity: "warning",
        message: `${parseErrors.length} syntax error(s); first: ${parseErrors[0]}. References were extracted from the recoverable syntax tree.`,
        file: rel,
      });
    }
    for (const u of unsupported) {
      unsupportedCount++;
      diagnostics.push({
        code: "unsupported-expression",
        severity: "info",
        message: `Non-literal ${u.kind === "require" ? "require()" : "import()"} cannot be resolved statically: ${u.text}`,
        location: { file: rel, line: u.line, column: u.column },
      });
    }
    const source = `file:${rel}`;
    const fileMode = moduleTypeOf(rel);
    const r0 = performance.now();
    for (const ref of references) {
      const mode =
        ref.kind === "require" ? "require" : ref.kind === "dynamic-import" ? "import" : fileMode;
      const res = resolver.resolve(ref.specifier, rel, mode);
      let target: string | null = null;
      let resolution: GraphEdge["resolution"] = "resolved";
      let diagnostic: string | undefined;
      if (res.kind === "file") {
        target = addFileNode(res.path);
        diagnostic = res.note;
      } else if (res.kind === "external" || res.kind === "builtin") {
        target = `${res.kind}:${res.name}`;
        if (!nodes.has(target))
          nodes.set(target, {
            id: target,
            kind: res.kind,
            path: res.name,
            displayName: res.name,
            package: null,
            language: null,
          });
        resolution = "external";
      } else {
        resolution = "unresolved";
        diagnostic = res.reason;
      }
      const dependencyClass: DependencyClass = ref.typeOnly ? "type-only" : "runtime";
      edges.push({
        id: `${source}|${ref.kind}|${ref.specifier}|${ref.line}:${ref.column}`,
        source,
        target,
        specifier: ref.specifier,
        importKind: ref.kind,
        dependencyClass,
        resolution,
        evidence: { file: rel, line: ref.line, column: ref.column, text: ref.text },
        ...(diagnostic ? { diagnostic } : {}),
      });
    }
    resolveMs += performance.now() - r0;
  });
  timings.parse = Math.round(parseMs * 100) / 100;
  timings.resolve = Math.round(resolveMs * 100) / 100;
  mark("extract");

  const nodeList = [...nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  edges.sort((a, b) => (a.id < b.id ? -1 : 1));
  const findings = computeFindings({ nodes: nodeList, edges });
  mark("algorithms");

  const count = (vals: string[]) =>
    Object.fromEntries(
      [...new Set(vals)].sort().map((k) => [k, vals.filter((v) => v === k).length]),
    );
  diagnostics.sort((a, b) => {
    const ka = `${a.file ?? a.location?.file ?? ""}\0${a.location?.line ?? 0}\0${a.code}\0${a.message}`;
    const kb = `${b.file ?? b.location?.file ?? ""}\0${b.location?.line ?? 0}\0${b.code}\0${b.message}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const hasLimitations =
    edges.some((e) => e.resolution === "unresolved") ||
    diagnostics.some((d) => d.severity !== "info" || d.code === "unsupported-expression");
  const status: AnalysisStatus = hasLimitations ? "completed_with_limitations" : "completed";

  let repoName = path.basename(root);
  try {
    const rootPkg = JSON.parse(readRel("package.json") ?? "{}");
    if (typeof rootPkg.name === "string") repoName = rootPkg.name;
  } catch {
    /* reported above */
  }
  let commit = readCommit(rootAbs);
  if (options.repository) ({ name: repoName, commit } = options.repository);
  const configHash = sha(
    JSON.stringify({ exclude: [...exclude].sort(), maxFiles, maxFileBytes }),
  ).slice(0, 16);
  const analysisId = sha(
    JSON.stringify([
      repoName,
      commit,
      ANALYZER_VERSION,
      SCHEMA_VERSION,
      configHash,
      nodeList,
      edges,
    ]),
  ).slice(0, 24);

  const graph: ArchmapGraph = {
    metadata: {
      analysisId,
      schemaVersion: SCHEMA_VERSION,
      analyzerVersion: ANALYZER_VERSION,
      compilerVersion,
      repository: { name: repoName, commit },
      configHash,
      status,
      generatedAt: options.reproducible ? null : new Date().toISOString(),
      counts: {
        filesDiscovered: discovered,
        filesAnalyzed: sources.length,
        filesExcluded: excluded,
        filesSkipped: skipped,
      },
    },
    nodes: nodeList,
    edges,
    findings,
    diagnostics,
    coverage: {
      supportedConstructs: SUPPORTED_CONSTRUCTS,
      importKinds: count(edges.map((e) => e.importKind)),
      resolutions: count(edges.map((e) => e.resolution)),
      unsupportedExpressions: unsupportedCount,
      filesWithParseErrors: parseErrorFiles,
    },
  };
  mark("serialize-prep");
  return { graph, timings };
}
