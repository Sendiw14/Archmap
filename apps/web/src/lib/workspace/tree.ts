import type { GraphNode } from "@archmap/graph-schema";

/**
 * File/package tree over graph nodes. Pure data structures: the explorer panel, the Files page
 * and the large-graph aggregation all derive from the same tree.
 */

export type TreeKind = "root" | "package" | "dir" | "file" | "group";
export type GroupBy = "directory" | "package";

export interface TreeNode {
  id: string;
  label: string;
  kind: TreeKind;
  children: TreeNode[];
  /** Set on leaves: the graph node id. */
  nodeId?: string;
  node?: GraphNode;
  /** Number of graph nodes (leaves) below this entry; 1 for a leaf. */
  count: number;
  /** For `dir` entries: the repository-relative directory path. */
  path?: string;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function sortTree(t: TreeNode): void {
  t.children.sort((a, b) => {
    const aLeaf = a.nodeId !== undefined ? 1 : 0;
    const bLeaf = b.nodeId !== undefined ? 1 : 0;
    // folders first, then files; groups of externals last
    const rank = (n: TreeNode) => (n.kind === "group" ? 2 : n.nodeId !== undefined ? 1 : 0);
    return rank(a) - rank(b) || aLeaf - bLeaf || cmp(a.label, b.label) || cmp(a.id, b.id);
  });
  for (const c of t.children) sortTree(c);
}

function countLeaves(t: TreeNode): number {
  if (t.nodeId !== undefined) return (t.count = 1);
  let n = 0;
  for (const c of t.children) n += countLeaves(c);
  return (t.count = n);
}

/** Merge a folder with its only child folder ("src" + "lib" -> "src/lib"), like GitHub does. */
function compress(t: TreeNode): void {
  for (const c of t.children) compress(c);
  t.children = t.children.map((c) => {
    let cur = c;
    while (cur.kind === "dir" && cur.children.length === 1 && cur.children[0]!.kind === "dir") {
      const only = cur.children[0]!;
      cur = { ...only, label: `${cur.label}/${only.label}` };
    }
    return cur;
  });
}

export function buildTree(nodes: readonly GraphNode[], groupBy: GroupBy): TreeNode {
  const root: TreeNode = { id: "root", label: "root", kind: "root", children: [], count: 0 };
  const index = new Map<string, TreeNode>([["root", root]]);

  const child = (
    parent: TreeNode,
    id: string,
    label: string,
    kind: TreeKind,
    path?: string,
  ): TreeNode => {
    let c = index.get(id);
    if (!c) {
      c = { id, label, kind, children: [], count: 0, path };
      index.set(id, c);
      parent.children.push(c);
    }
    return c;
  };

  for (const n of nodes) {
    const leaf: TreeNode = {
      id: `leaf:${n.id}`,
      label: n.kind === "file" ? (n.path.split("/").pop() ?? n.path) : n.displayName,
      kind: "file",
      children: [],
      nodeId: n.id,
      node: n,
      count: 1,
    };
    if (n.kind === "external" || n.kind === "builtin") {
      const g = child(
        root,
        n.kind === "external" ? "group:external" : "group:builtin",
        n.kind === "external" ? "External packages" : "Node.js built-ins",
        "group",
      );
      g.children.push(leaf);
      continue;
    }
    let parent = root;
    const segs = n.path.split("/");
    const dirs = segs.slice(0, -1);
    const pkgKey = n.package ?? "";
    if (groupBy === "package") {
      parent = child(root, `pkg:${pkgKey}`, n.package ?? "(no package)", "package");
    }
    let acc = "";
    for (const d of dirs) {
      acc = acc ? `${acc}/${d}` : d;
      const id = groupBy === "package" ? `dir:${pkgKey}:${acc}` : `dir:${acc}`;
      parent = child(parent, id, d, "dir", acc);
    }
    parent.children.push(leaf);
  }
  if (groupBy === "package") {
    // inside a package, hide the directory prefix shared by the whole package
    for (const p of root.children) if (p.kind === "package") compress(p);
  }
  compress(root);
  countLeaves(root);
  sortTree(root);
  return root;
}

export interface TreeRow {
  id: string;
  label: string;
  kind: TreeKind;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  nodeId?: string;
  count: number;
  /** Position within siblings, for aria-posinset/setsize. */
  pos: number;
  size: number;
}

/**
 * Visible rows. With `matchIds`, only branches that contain a match are listed and they are
 * all expanded (so search results are never hidden in a collapsed folder).
 */
export function flattenTree(
  root: TreeNode,
  expanded: ReadonlySet<string>,
  matchIds: ReadonlySet<string> | null = null,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const keep = matchIds ? subtreeHasMatch(root, matchIds) : null;
  const walk = (t: TreeNode, depth: number) => {
    const kids = keep ? t.children.filter((c) => keep.has(c.id)) : t.children;
    kids.forEach((c, i) => {
      const hasChildren = c.children.length > 0 && c.nodeId === undefined;
      const open = hasChildren && (matchIds ? true : expanded.has(c.id));
      rows.push({
        id: c.id,
        label: c.label,
        kind: c.kind,
        depth,
        hasChildren,
        expanded: open,
        nodeId: c.nodeId,
        count: c.count,
        pos: i + 1,
        size: kids.length,
      });
      if (open) walk(c, depth + 1);
    });
  };
  walk(root, 0);
  return rows;
}

function subtreeHasMatch(root: TreeNode, matchIds: ReadonlySet<string>): Set<string> {
  const keep = new Set<string>();
  const visit = (t: TreeNode): boolean => {
    let any = t.nodeId !== undefined && matchIds.has(t.nodeId);
    for (const c of t.children) if (visit(c)) any = true;
    if (any) keep.add(t.id);
    return any;
  };
  visit(root);
  return keep;
}

/** Ancestor ids (top to bottom, excluding the root) for every leaf, keyed by graph node id. */
export function ancestorMap(root: TreeNode): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const walk = (t: TreeNode, path: string[]) => {
    for (const c of t.children) {
      if (c.nodeId !== undefined) out.set(c.nodeId, path);
      else walk(c, [...path, c.id]);
    }
  };
  walk(root, []);
  return out;
}

export function findTreeNode(root: TreeNode, id: string): TreeNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const hit = findTreeNode(c, id);
    if (hit) return hit;
  }
  return null;
}

/** All leaf graph-node ids below `t`. */
export function leafIds(t: TreeNode): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode) => {
    if (n.nodeId !== undefined) out.push(n.nodeId);
    else for (const c of n.children) walk(c);
  };
  walk(t);
  return out;
}

/** Ids of every collapsible entry (used by "expand all"). */
export function allBranchIds(root: TreeNode): Set<string> {
  const out = new Set<string>();
  const walk = (t: TreeNode) => {
    for (const c of t.children)
      if (c.nodeId === undefined) {
        out.add(c.id);
        walk(c);
      }
  };
  walk(root);
  return out;
}
