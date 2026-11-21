# Analyzer benchmark

Method: `node tests/performance/bench-analyzer.ts <workdir>` generates synthetic repos (files in 20 directories, 5 relative imports each, cycles present), runs `analyze()` once (cold process, warm FS cache) and reports phase timings from the analyzer.

Environment: Apple M4, 16 GiB RAM, macOS (Darwin 27), Node 24.11.1, 2026-11-21. Single run — indicative, not a budget.

| files | edges | scan ms | parse ms | resolve ms | algorithms ms | total ms | RSS delta MB | JSON MB |
| ----- | ----- | ------- | -------- | ---------- | ------------- | -------- | ------------ | ------- |
| 100   | 500   | 1.09    | 11.32    | 7.32       | 1.79          | 25       | 11           | 0.2     |
| 1000  | 5000  | 3.63    | 20.01    | 50.1       | 11.15         | 107      | 43           | 2.0     |
| 5000  | 25000 | 14      | 72.12    | 260.93     | 59.11         | 511      | 200          | 10.0    |

Not yet measured: real-world repositories, peak (vs delta) memory, serialization time separately, Linux/Windows.
