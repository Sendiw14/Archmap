# ADR-0004: Graph contract, determinism and finding rules

Status: Accepted (2026-11-21)

- One edge per source reference (statement), direction importer → imported. Edge id: `<source>|<kind>|<specifier>|<line>:<col>`. Node ids: `file:<path>`, `external:<pkg>`, `builtin:node:<name>`.
- Everything is sorted by id. `analysisId` hashes repository, commit, versions, config hash, nodes and edges. `generatedAt` is the only non-deterministic field and is `null` under `--reproducible`.
- Commit SHA is read from `.git/HEAD` / refs files; git is never executed.
- Findings (rules versioned):
  - `runtime-cycle` (scc-tarjan@1, warning): SCC over runtime edges with size > 1 or a self-loop.
  - `type-cycle` (scc-tarjan@1, info): SCC that appears only when type-only edges are included.
  - `hotspot` (coupling-zscore@1, info): file with fanIn + fanOut ≥ max(8, ⌈mean + 2·stddev⌉) over file nodes (self-loops excluded).
  - `unresolved` (unresolved-import@1, warning): one per file with unresolved imports.
- Status is `completed_with_limitations` when any edge is unresolved or any warning/error/unsupported-expression diagnostic exists.
