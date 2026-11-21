import type { GraphNode } from "@archmap/graph-schema";

/** Indexed path search: lowercase once at build time, then substring-match every token. */
interface Entry {
  id: string;
  path: string;
  lower: string;
  baseStart: number;
}
export interface SearchIndex {
  entries: Entry[];
}
export interface SearchHit {
  id: string;
  path: string;
  /** [start, end) ranges within `path` to emphasise. */
  ranges: [number, number][];
}

export function buildSearchIndex(nodes: GraphNode[]): SearchIndex {
  return {
    entries: nodes.map((n) => {
      const lower = `${n.path}`.toLowerCase();
      return { id: n.id, path: n.path, lower, baseStart: lower.lastIndexOf("/") + 1 };
    }),
  };
}

export function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export function searchPaths(index: SearchIndex, query: string, limit = 50): SearchHit[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const scored: { hit: SearchHit; rank: number }[] = [];
  for (const e of index.entries) {
    const ranges: [number, number][] = [];
    let rank = 2;
    let ok = true;
    for (const t of tokens) {
      const at = e.lower.indexOf(t);
      if (at < 0) {
        ok = false;
        break;
      }
      ranges.push([at, at + t.length]);
      const inBase = e.lower.indexOf(t, e.baseStart);
      if (inBase === e.baseStart) rank = Math.min(rank, 0);
      else if (inBase >= 0) rank = Math.min(rank, 1);
    }
    if (ok) scored.push({ hit: { id: e.id, path: e.path, ranges: mergeRanges(ranges) }, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || (a.hit.path < b.hit.path ? -1 : 1));
  return scored.slice(0, limit).map((s) => s.hit);
}
