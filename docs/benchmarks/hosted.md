# Hosted pipeline evidence

Environment: Docker Compose stack from `infrastructure/docker-compose.yml` (Postgres 17.6, Redis 7.4, SeaweedFS 3.97, API + worker images on node:24.11.1-slim, hardened: read-only root FS, `cap_drop: ALL`, `no-new-privileges`, tmpfs work dir), Docker 29.5.2 on the developer machine (Apple M4 host), 2026-11-21.

## Real-infrastructure tests

`ARCHMAP_IT=1 ARCHMAP_API_URL=http://127.0.0.1:4100 pnpm vitest run tests/integration` (stack with `ARCHMAP_SOURCE=fixtures`): **6/6 passed**: idempotent migrations, concurrent compare-and-set (10 racers, 1 winner), S3 round-trip/missing object, BullMQ jobId dedupe → worker → completed, health endpoints, HTTP create → poll → graph → unauthorized delete (401) → cookie delete (204) → 404.

## Live public GitHub repositories (`ARCHMAP_SOURCE=github`)

| Repository                   | Commit     | Status                     | Files | Edges | Findings | Unresolved | Job time | Notes                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ---------- | -------------------------- | ----- | ----- | -------- | ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| colinhacks/zod               | 2a343ed2a4 | completed_with_limitations | 525   | 1472  | 22       | 23         | 60.0 s   | ~59 s spent downloading the archive on this network; analysis < 1 s. 4 symlinks skipped. 3 non-literal `import()`/`require()` diagnosed. `customConditions: ["@zod/source"]` honored. Unresolved imports are in `packages/resolution` (tests published-build resolution) and `packages/docs` (tsconfig without the source condition), whose targets are build outputs absent from source. |
| sindresorhus/ky (ref `main`) | 3541888878 | completed_with_limitations | 98    | 311   | 25       | —          | 11.1 s   |                                                                                                                                                                                                                                                                                                                                                                                           |

Error paths verified live: nonexistent repository → `404 repository_not_found`; unknown ref → `404 ref_not_found`.

Container memory after both jobs (`docker stats`): api 281 MiB, worker 120 MiB, postgres 31 MiB, redis 5 MiB, s3 29 MiB.

Not measured: sustained throughput, worker behaviour under concurrent large repositories, archive download times on production networks.

## Reliability drills (spec §17.8), same stack

| Drill                                                                      | Result                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker kill` worker while job `fetching` (sindresorhus/got), then restart | BullMQ re-delivered the stalled job after lock expiry; pipeline logged `recovering interrupted job`, reset to `queued`, completed (183 files) 68 s after restart.                                                                                                                                                                                   |
| Stop Postgres                                                              | **Defect found**: API and worker crashed (unhandled `error` on idle pg clients; 2 restarts each). Fixed with a pool error listener. After fix: `/health/ready` → 503 `store: fail`, `/health/live` → 200, create → 500 `internal` (generic), zero restarts; recovered automatically when Postgres returned. Regression test in `tests/integration`. |
| Restart Redis                                                              | Readiness recovered; next submission (sindresorhus/is) completed normally.                                                                                                                                                                                                                                                                          |
| GitHub errors                                                              | Nonexistent repo → 404 `repository_not_found`; bad ref → 404 `ref_not_found`; transient failures retried (unit-tested).                                                                                                                                                                                                                             |

Known gap: a store outage during `POST /v1/analyses` returns 500 `internal` rather than 503.
