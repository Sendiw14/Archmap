import { z } from "zod";

/**
 * ARCHMAP normalized graph contract.
 * Edge direction is ALWAYS importing module (source) -> imported module (target).
 * Bump SCHEMA_VERSION on any change; breaking changes bump the major.
 */
export const SCHEMA_VERSION = "1.0.0";

export const Language = z.enum([
  "ts",
  "tsx",
  "mts",
  "cts",
  "dts",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
]);

export const SourceLocation = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
});

export const NodeKind = z.enum(["file", "external", "builtin"]);

export const GraphNode = z.object({
  id: z.string(),
  kind: NodeKind,
  /** Repository-relative POSIX path for files; package name for externals/builtins. */
  path: z.string(),
  displayName: z.string(),
  /** Owning workspace package name, if any. */
  package: z.string().nullable(),
  language: Language.nullable(),
});

export const ImportKind = z.enum([
  "import", // import x from "y" / import "y"
  "export", // export ... from "y"
  "require", // require("y") / import x = require("y")
  "dynamic-import", // import("y") with a literal
  "import-type", // typeof import("y") in type positions
]);

export const DependencyClass = z.enum(["runtime", "type-only"]);

export const Resolution = z.enum(["resolved", "external", "unresolved"]);

export const GraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  /** Target node id; null when unresolved. */
  target: z.string().nullable(),
  specifier: z.string(),
  importKind: ImportKind,
  dependencyClass: DependencyClass,
  resolution: Resolution,
  evidence: SourceLocation.extend({ text: z.string() }),
  diagnostic: z.string().optional(),
});

export const Severity = z.enum(["error", "warning", "info"]);

export const Diagnostic = z.object({
  code: z.string(),
  severity: Severity,
  message: z.string(),
  location: SourceLocation.optional(),
  file: z.string().optional(),
});

export const FindingCategory = z.enum(["runtime-cycle", "type-cycle", "hotspot", "unresolved"]);

export const Finding = z.object({
  id: z.string(),
  category: FindingCategory,
  severity: Severity,
  nodes: z.array(z.string()),
  /** Edge ids supporting the finding. */
  evidence: z.array(z.string()),
  explanation: z.string(),
  rule: z.string(),
});

export const AnalysisStatus = z.enum(["completed", "completed_with_limitations", "failed"]);

export const Coverage = z.object({
  supportedConstructs: z.array(z.string()),
  importKinds: z.record(z.string(), z.number().int()),
  resolutions: z.record(z.string(), z.number().int()),
  unsupportedExpressions: z.number().int(),
  filesWithParseErrors: z.number().int(),
});

export const AnalysisMetadata = z.object({
  analysisId: z.string(),
  schemaVersion: z.string(),
  analyzerVersion: z.string(),
  compilerVersion: z.string(),
  repository: z.object({ name: z.string(), commit: z.string().nullable() }),
  configHash: z.string(),
  status: AnalysisStatus,
  /** ISO timestamp; null when generated in reproducible mode. */
  generatedAt: z.string().nullable(),
  counts: z.object({
    filesDiscovered: z.number().int(),
    filesAnalyzed: z.number().int(),
    filesExcluded: z.number().int(),
    filesSkipped: z.number().int(),
  }),
});

export const ArchmapGraph = z.object({
  metadata: AnalysisMetadata,
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  findings: z.array(Finding),
  diagnostics: z.array(Diagnostic),
  coverage: Coverage,
});

export type Language = z.infer<typeof Language>;
export type SourceLocation = z.infer<typeof SourceLocation>;
export type NodeKind = z.infer<typeof NodeKind>;
export type GraphNode = z.infer<typeof GraphNode>;
export type ImportKind = z.infer<typeof ImportKind>;
export type DependencyClass = z.infer<typeof DependencyClass>;
export type Resolution = z.infer<typeof Resolution>;
export type GraphEdge = z.infer<typeof GraphEdge>;
export type Severity = z.infer<typeof Severity>;
export type Diagnostic = z.infer<typeof Diagnostic>;
export type FindingCategory = z.infer<typeof FindingCategory>;
export type Finding = z.infer<typeof Finding>;
export type AnalysisStatus = z.infer<typeof AnalysisStatus>;
export type Coverage = z.infer<typeof Coverage>;
export type AnalysisMetadata = z.infer<typeof AnalysisMetadata>;
export type ArchmapGraph = z.infer<typeof ArchmapGraph>;
