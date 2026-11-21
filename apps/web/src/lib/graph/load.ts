import { ArchmapGraph } from "@archmap/graph-schema";

export type LoadResult = { ok: true; graph: ArchmapGraph } | { ok: false; error: string };

/** Validate untrusted JSON against the shared contract, then check referential integrity. */
export function parseGraph(raw: unknown): LoadResult {
  const parsed = ArchmapGraph.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    return { ok: false, error: `Invalid graph file. ${issues.join("; ")}` };
  }
  const graph = parsed.data;
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.size !== graph.nodes.length)
    return { ok: false, error: "Invalid graph: duplicate node ids." };
  for (const e of graph.edges) {
    if (!ids.has(e.source) || (e.target !== null && !ids.has(e.target))) {
      return { ok: false, error: `Invalid graph: edge ${e.id} points to an unknown node.` };
    }
  }
  return { ok: true, graph };
}
