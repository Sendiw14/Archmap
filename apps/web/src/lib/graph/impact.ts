import type { ArchmapGraph } from "@archmap/graph-schema";
import { buildIndex, potentialImpact, type GraphIndex } from "@archmap/graph-core";
import type { ViewFilters, VisibleGraph } from "./model";

export const IMPACT_TITLE = "Potential change impact";
/** Wording rule (spec 5.5): reachability only, never "will break". */
export const IMPACT_DISCLAIMER =
  "These modules import this one, directly or through other modules, so a change here could reach them. This is static reachability from the import graph. It does not mean they will break or need edits.";

export interface ImpactRow {
  id: string;
  path: string;
  displayName: string;
  package: string | null;
  /** Number of import hops from the dependent to the selected module. */
  depth: number;
  /** Paths from the dependent through intermediate modules to the selected module. */
  chain: string[];
}

export interface ImpactView {
  nodeId: string;
  direct: ImpactRow[];
  indirect: ImpactRow[];
  total: number;
  packages: string[];
}

export function buildImpactIndex(graph: ArchmapGraph, filters: ViewFilters): GraphIndex {
  return buildIndex(graph, { typeOnly: filters.showTypeOnly });
}

export function impactView(
  index: GraphIndex,
  vg: Pick<VisibleGraph, "nodeById">,
  nodeId: string,
): ImpactView {
  if (!index.in.has(nodeId)) return { nodeId, direct: [], indirect: [], total: 0, packages: [] };
  const result = potentialImpact(index, nodeId);
  const directSet = new Set(result.direct);
  const row = (id: string): ImpactRow => {
    const n = vg.nodeById.get(id);
    const chain = (result.paths[id] ?? [id]).map((x) => vg.nodeById.get(x)?.path ?? x);
    return {
      id,
      path: n?.path ?? id,
      displayName: n?.displayName ?? id,
      package: n?.package ?? null,
      depth: chain.length - 1,
      chain,
    };
  };
  const byPath = (a: ImpactRow, b: ImpactRow) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const direct = result.direct.map(row).sort(byPath);
  const indirect = result.transitive
    .filter((id) => !directSet.has(id))
    .map(row)
    .sort((a, b) => a.depth - b.depth || byPath(a, b));
  const packages = [
    ...new Set([...direct, ...indirect].flatMap((r) => (r.package ? [r.package] : []))),
  ].sort();
  return { nodeId, direct, indirect, total: direct.length + indirect.length, packages };
}
