# Web workspace benchmarks

Spec 13.2: indexed search on the 1,000-node reference graph (p95 <= 150 ms), grouped rendering at 5,000 nodes.
Measured 2026-11-21. Numbers are from one machine and one run set; they are a regression baseline, not a capacity claim.

## Device and conditions

| Item        | Value                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Machine     | Apple M4, 10 cores, 16 GB RAM, macOS (Darwin 27.0.0)                                                                                                         |
| Browser     | Chromium 159.0.8154.6 via Playwright 1.65.1, headless, 1280x720 window                                                                                       |
| Build       | `next build` production build served by `next start`                                                                                                         |
| Node        | 24.11.1                                                                                                                                                      |
| Cache state | Fresh browser context per test (cold HTTP cache); JS warm after the first query for the "warm" figures                                                       |
| Reproduce   | `PERF=1 pnpm --filter @archmap/web test:e2e perf` (writes `apps/web/test-results/perf.json`) and `pnpm vitest run apps/web/src/lib/workspace` (search guard) |

## Dataset

`apps/web/src/lib/workspace/synthetic.ts` generates deterministic synthetic repositories (seeded PRNG). They are **not analyzer output** and are labelled "Synthetic benchmark graph" in the UI. Shape: layered packages, imports mostly towards lower indices, some cross-package imports, 40 externals, 6 built-ins, about 1% unresolved imports and a few runtime cycles.

| Graph | File nodes | All nodes | Edges  |
| ----- | ---------- | --------- | ------ |
| 1,000 | 1,000      | 1,046     | 3,424  |
| 5,000 | 5,000      | 5,046     | 17,235 |

Routes: `/analyses/demo-synthetic-1000` and `/analyses/demo-synthetic-5000` (also 100 and 500). A "larger stress-test graph" beyond 5,000 nodes was not run.

## Indexed search (the spec target)

Method, in the browser: for each of 20 queries (prefixes of `module-0123`, package and folder names, a miss, `node:fs`, ...), set the search input's value, dispatch an `input` event, and wait two animation frames (React commit plus paint) in the graph view with 1,000 modules. Three passes; the first pass is warm-up, the next two are reported. The measured span therefore includes the index lookup, React re-render of the explorer tree, the highlight and match recomputation, and React Flow node updates.

| Measure (1,000-node graph, graph view) | Result                  |
| -------------------------------------- | ----------------------- |
| First query, cold                      | 48.8 ms                 |
| Warm p50 / p95 / max (40 samples)      | 33.1 / 33.8 / 35.0 ms   |
| **Target**                             | **p95 <= 150 ms. Met.** |

Two frames at 60 Hz is 33 ms, so the warm figure is bounded by the display: the work fits in the frame budget. The same run before the dense-layout change measured p95 98 ms (the earlier run drew 118 items and 3,412 dependencies instead of 39 items).

The pure search function (`searchPaths` over `buildSearchIndex`), in Node, 400 samples per graph:

| Graph | Build index | p50     | p95     | max     |
| ----- | ----------- | ------- | ------- | ------- |
| 1,000 | 0.2 ms      | 0.03 ms | 0.17 ms | 1.59 ms |
| 5,000 | 0.8 ms      | 0.10 ms | 0.67 ms | 1.58 ms |

`workspace.test.ts` asserts p95 < 150 ms for the 1,000-node function so a regression fails CI.

## Grouped rendering

Method: load the route, time from navigation start to the first React Flow node; read the canvas's own layout timing; focus the first collapsed group and press Enter, time until the new layout is drawn; select a visible module and time until the inspector heading appears; switch to List and time until the first row.

| Measure                                     | 1,000 graph                           | 5,000 graph                           |
| ------------------------------------------- | ------------------------------------- | ------------------------------------- |
| Modules drawn at start                      | 1,046 modules as 39 items (33 groups) | 5,046 modules as 39 items (39 groups) |
| Page load to first graph node               | 462 ms                                | 1,011 ms                              |
| Initial layout (ELK in a Web Worker)        | 285 ms                                | 305 ms                                |
| Expand one group, to new layout on screen   | 526 ms                                | 585 ms                                |
| Select a module, to inspector               | 113 ms                                | 181 ms                                |
| List view, to first row (paged at 300 rows) | 88 ms                                 | 85 ms                                 |
| JS heap after the interaction sequence      | 24.8 MB                               | 45.2 MB                               |

Tree, initial grouping and aggregation of the 5,000-node graph take about 7 ms in Node (dominated by edge aggregation); `deriveVisible` takes 11 ms.

## What the numbers rest on

- **Aggregation, not brute force.** Above 400 file nodes the canvas draws the frontier of a folder or package tree, starting at roughly 40 items. Edges between groups are the sum of their members' edges (unit-tested: crossing plus internal edges equal all drawn edges; expanding everything reproduces the ungrouped graph exactly).
- **Dense profile.** When a drawn graph has more than 150 edges the layout switches from ELK layered (orthogonal) to ELK stress, then overlaps are removed and edges are drawn straight. Before this change the 1,000-node overview used a layered layout about 10,800 px wide, which was unreadable at fit zoom and took 1.3 s; the 5,000-node expansion took 6.2 s.
- **Workers.** ELK always runs in a module Web Worker with a main-thread fallback, so layout never blocks input.
- **Large trees and lists** are windowed (explorer tree above 250 rows) or paged (list, 300 rows), and React Flow renders only visible elements above 250 items.

## Known limits

- Single machine, headless Chromium, no throttling: no mid-range phone or CPU-throttled numbers exist yet.
- Core Web Vitals (LCP, INP, CLS) are not measured here; spec 13.1 asks for lab and field data. Not done.
- Expanding "all" at 5,000 file nodes is deliberately refused (file-level drawing is capped at 1,500 nodes); the cap itself was not benchmarked.
- The stress layout does not place importers left of imported modules; arrows carry the direction. Dense overviews are for orientation, and the explorer and search are the way to reach a module.
