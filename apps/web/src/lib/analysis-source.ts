import type { AnalysisSummary, JobStatus } from "@archmap/contracts";
import type { ArchmapGraph } from "@archmap/graph-schema";
import { SAMPLES, type DemoSample } from "./graph/samples";
import { parseGraph } from "./graph/load";
import { makeSyntheticGraph, SYNTHETIC_ANALYZER } from "./workspace/synthetic";

/**
 * Where an analysis comes from.
 *
 * Decision (documented in docs/design/routes.md): `/analyses/demo-<sample>` renders the
 * bundled demo JSON through exactly the same workspace, insights, files and report routes
 * as a hosted analysis, with no API and no network. So the whole product works offline, and
 * the E2E suite can exercise every route without a backend. `demo-synthetic-<n>` are
 * deterministic generated stress-test graphs, labelled as such.
 */

export const DEMO_PREFIX = "demo-";
export const SYNTHETIC_SIZES = [100, 500, 1000, 5000] as const;

export type DemoSource =
  { kind: "sample"; sample: DemoSample } | { kind: "synthetic"; files: number };

export function demoSourceFor(id: string): DemoSource | null {
  if (!id.startsWith(DEMO_PREFIX)) return null;
  const rest = id.slice(DEMO_PREFIX.length);
  const synth = /^synthetic-(\d+)$/.exec(rest);
  if (synth) {
    const files = Number(synth[1]);
    return (SYNTHETIC_SIZES as readonly number[]).includes(files)
      ? { kind: "synthetic", files }
      : null;
  }
  const sample = SAMPLES.find((s) => s.id === rest);
  return sample ? { kind: "sample", sample } : null;
}

export const isDemoId = (id: string) => id.startsWith(DEMO_PREFIX);

export async function loadDemoGraph(src: DemoSource): Promise<ArchmapGraph> {
  if (src.kind === "synthetic") return makeSyntheticGraph(src.files);
  const res = parseGraph(await src.sample.load());
  if (!res.ok) throw new Error(res.error);
  return res.graph;
}

export interface AnalysisMeta {
  id: string;
  source: "hosted" | "demo";
  repoLabel: string;
  repoUrl: string | null;
  ref: string | null;
  commit: string | null;
  status: JobStatus | "completed" | "completed_with_limitations";
  analyzerVersion: string;
  schemaVersion: string;
  compilerVersion: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  synthetic: boolean;
  /** Demo only: what was analyzed and how, for provenance. */
  sample: DemoSample | null;
}

export function metaFromSummary(s: AnalysisSummary, graph: ArchmapGraph): AnalysisMeta {
  return {
    id: s.id,
    source: "hosted",
    repoLabel: `${s.repository.owner}/${s.repository.repo}`,
    repoUrl: s.repository.url,
    ref: s.ref,
    commit: s.commit,
    status: s.status,
    analyzerVersion: s.analyzerVersion,
    schemaVersion: s.schemaVersion,
    compilerVersion: graph.metadata.compilerVersion,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    synthetic: false,
    sample: null,
  };
}

export function metaFromDemo(id: string, src: DemoSource, graph: ArchmapGraph): AnalysisMeta {
  const m = graph.metadata;
  const synthetic = src.kind === "synthetic" || m.analyzerVersion === SYNTHETIC_ANALYZER;
  return {
    id,
    source: "demo",
    repoLabel: src.kind === "sample" ? src.sample.label : `Synthetic graph, ${src.files} files`,
    repoUrl: null,
    ref: null,
    commit: m.repository.commit,
    status: m.status,
    analyzerVersion: m.analyzerVersion,
    schemaVersion: m.schemaVersion,
    compilerVersion: m.compilerVersion,
    createdAt: m.generatedAt,
    expiresAt: null,
    synthetic,
    sample: src.kind === "sample" ? src.sample : null,
  };
}
