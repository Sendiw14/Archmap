import type { ArchmapGraph } from "@archmap/graph-schema";
import { parseGraph } from "../graph/load";
import { SAMPLES } from "../graph/samples";
import { buildImpactIndex, impactView, type ImpactView } from "../graph/impact";
import {
  cycleItems,
  DEFAULT_FILTERS,
  deriveVisible,
  inspectNode,
  mostImportedFile,
  type CycleItem,
  type NodeInspection,
} from "../graph/model";
import { buildPreview, type PreviewData } from "./preview";

/** Everything the landing page shows, derived at build time from the committed demo analyses. */

export interface StoryEdge {
  /** Drawn-edge id in the circular preview. */
  drawnId: string;
  file: string;
  line: number;
  column: number;
  text: string;
  source: string;
  target: string;
}

export interface LandingData {
  heroFiles: PreviewData;
  heroPackages: PreviewData;
  cycle: PreviewData;
  story: {
    edges: StoryEdge[];
    cycleId: string;
    cycleSize: number;
    rule: string;
    explanation: string;
  };
  /** Real inspector data for every file in the ARCHMAP sample. */
  inspections: Record<string, NodeInspection>;
  impacts: Record<string, ImpactView>;
  cycles: CycleItem[];
  featured: string | null;
  facts: {
    files: number;
    imports: number;
    analyzer: string;
    compiler: string;
    schema: string;
    commit: string | null;
  };
}

async function load(id: string): Promise<ArchmapGraph> {
  const res = parseGraph(await SAMPLES.find((s) => s.id === id)!.load());
  if (!res.ok) throw new Error(`Demo sample ${id} is invalid: ${res.error}`);
  return res.graph;
}

export async function getLandingData(): Promise<LandingData> {
  const [arch, circ] = await Promise.all([load("archmap"), load("circular")]);
  const [heroFiles, heroPackages, cycle] = await Promise.all([
    buildPreview(arch, { showExternals: false }),
    buildPreview(arch, { showExternals: false, collapseToPackages: true }),
    buildPreview(circ),
  ]);

  const vg = deriveVisible(arch, { ...DEFAULT_FILTERS, showExternals: false });
  const index = buildImpactIndex(arch, { ...DEFAULT_FILTERS, showExternals: false });
  const inspections: Record<string, NodeInspection> = {};
  const impacts: Record<string, ImpactView> = {};
  for (const n of vg.nodes) {
    const ins = inspectNode(arch, vg, n.id);
    if (ins) inspections[n.id] = ins;
    impacts[n.id] = impactView(index, vg, n.id);
  }

  const cyc = circ.findings.find((f) => f.category === "runtime-cycle")!;
  const edgeById = new Map(circ.edges.map((e) => [e.id, e]));
  const story = {
    cycleId: cyc.id,
    cycleSize: cyc.nodes.length,
    rule: cyc.rule,
    explanation: cyc.explanation,
    edges: cyc.evidence.flatMap((id) => {
      const e = edgeById.get(id);
      return e && e.target
        ? [
            {
              drawnId: `${e.source}>>${e.target}`,
              file: e.evidence.file,
              line: e.evidence.line,
              column: e.evidence.column,
              text: e.evidence.text,
              source: e.source,
              target: e.target,
            },
          ]
        : [];
    }),
  };

  return {
    heroFiles,
    heroPackages,
    cycle,
    story,
    inspections,
    impacts,
    cycles: cycleItems(arch),
    featured: mostImportedFile(vg),
    facts: {
      files: arch.nodes.filter((n) => n.kind === "file").length,
      imports: arch.edges.length,
      analyzer: arch.metadata.analyzerVersion,
      compiler: arch.metadata.compilerVersion,
      schema: arch.metadata.schemaVersion,
      commit: arch.metadata.repository.commit,
    },
  };
}
