# Development status and release-readiness report

_Last updated: 2026-11-22. Format follows spec §23. "Verified" means an executed test or recorded run; everything else is labelled._

## Verdict

**Not production-ready. Feature-complete for v1.0 and verified locally; release blocked on items that need the project owner or a real deployment.**

Release blockers (spec §21):

1. **CI has never run on GitHub.** No remote is configured. Windows/Linux/Node 22 matrices, the Docker build job and the integration job are unverified remotely.
2. **No production deployment.** Hosting vendor not chosen (paid commitment needs the owner). Smoke tests ran only against the local Docker stack.
3. **License not confirmed.** MIT is proposed in `LICENSE`; the owner must confirm ownership before public release.
4. **Manual accessibility pass not done.** Automated axe checks show zero serious/critical violations on 19 routes, but there has been no screen-reader session (VoiceOver/NVDA) and no manual zoom/reflow review.
5. **Core Web Vitals field data does not exist.** Only lab measurements were taken.
6. **Worker egress restriction is deployment-level.** It must be enforced by the hosting network policy (ADR-0005).

## Milestones

| Milestone                     | State               | Gate evidence                                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Discovery & baseline       | Partial             | Spec, register, ADR-0001–0005, threat model (analyzer + hosted), architecture, route inventory (`docs/design/routes.md`), API contract (`docs/api/openapi.json`), retention (ADR-0005, runbook). Missing as separate documents: PRD, personas/journeys, risk register. |
| M1 Compatibility & foundation | Gate passed locally | Monorepo, format/lint/typecheck/test, compiler proof (TS 6.0.2), React Flow 13 + ELK proof, design tokens. CI defined, not run remotely.                                                                                                                               |
| M2 Analysis engine            | Gate passed locally | 19 golden fixtures, determinism, evidence checks; a resolver defect was found by the real-package benchmark and fixed (fixture `directory-index`).                                                                                                                     |
| M3 CLI & MVP                  | Gate passed locally | CLI tests; installable bundle (`pnpm build:cli`) verified byte-identical to the source CLI after a clean `npm install` of the tarball.                                                                                                                                 |
| M4 Full workspace             | Gate passed locally | Workspace, insights, files, report, grouping above 400 modules, list alternative, SVG export; 102 Playwright E2E tests pass (re-run independently); search p95 33.8 ms at 1,000 nodes.                                                                                 |
| M5 Hosted ingestion           | Gate passed locally | 13 API + 16 pipeline + 23 contract tests; 7/7 real Postgres/Redis/S3 tests; live GitHub runs; worker-kill, Postgres and Redis outage drills (`docs/benchmarks/hosted.md`).                                                                                             |
| M6 Website & docs             | Gate passed locally | All §9 routes; axe: 0 serious/critical on 19 routes; no overflow at 360–1920 px; 56 screenshots in `docs/design/screenshots/`.                                                                                                                                         |
| M7 Production validation      | **Blocked**         | See verdict.                                                                                                                                                                                                                                                           |

## Test execution (2026-11-22, Apple M4, Node 24.11.1)

| Suite                                         | Command                                                                                | Result                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------- |
| Unit, golden, CLI, API, pipeline, web logic   | `pnpm test`                                                                            | 205 passed, 7 skipped (opt-in IT) |
| Real infrastructure + deployed-API smoke test | `ARCHMAP_IT=1 ARCHMAP_API_URL=http://127.0.0.1:4100 pnpm vitest run tests/integration` | 7 passed                          |
| E2E + axe (production build, memory API)      | `pnpm --filter @archmap/web test:e2e`                                                  | 102 passed, 59 opt-in skipped     |
| Static checks                                 | `pnpm format && pnpm lint && pnpm typecheck`                                           | pass                              |
| Web build                                     | `pnpm --filter @archmap/web build`                                                     | pass                              |
| Dependency audit                              | `pnpm audit --audit-level high`                                                        | no known vulnerabilities          |
| CLI package                                   | `pnpm build:cli` → `npm pack` → clean install → compare output                         | identical                         |
| Manual browser                                | Real GitHub import → workspace → creator delete through the UI                         | pass                              |

## Defects found and fixed during verification

| Defect                                                                        | Found by                         | Fix / guard                                                                  |
| ----------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Directory imports (`".."`, `"./"`) unresolved (1,344 in `@aws-sdk/client-s3`) | Real-package benchmark           | Trailing-slash normalization in the resolver host; fixture `directory-index` |
| API and worker crashed when Postgres restarted                                | Outage drill on Docker stack     | pg pool error listener; integration regression test                          |
| Exports subpath resolution skipped (virtual `node_modules` missing)           | Golden fixture `package-exports` | `directoryExists` overlay                                                    |
| Screen readers told edges can be deleted (React Flow default text)            | Manual browser review            | Custom `edge.a11yDescription.default`                                        |
| Dense grouped graphs laid out in 6.2 s, unreadable                            | Web benchmark                    | ELK stress layout above 150 drawn edges                                      |

## Selected versions (installed, pinned in lockfile)

| Area              | Versions                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime / tooling | Node 24.11.1 (≥ 22.18 required), pnpm 9.15.9, TypeScript 6.0.3 (typecheck), esbuild 0.28.2, Vitest 5.1.1, ESLint 10, Prettier 3                                         |
| Analyzer          | ts-morph 28.0.0 (bundles TypeScript 6.0.2), zod 4, commander 15                                                                                                         |
| Web               | Next 16.4.6, React 19.3.1, @xyflow/react 13.0.2, elkjs 0.12.1, Tailwind 4.3.5, motion 14.14.0, lucide-react 1.77.0                                                      |
| Hosted            | Fastify 5.12.8 (+ helmet 13.2.0, rate-limit 11.3.0, cookie 11.1.5), drizzle-orm 0.45.4, pg 8.23.1, BullMQ 6.7.8, ioredis 6.0.0, @aws-sdk/client-s3 3.1175.0, tar 7.5.23 |
| Testing           | Playwright 1.65.1, @axe-core/playwright 4.14.0                                                                                                                          |
| Containers        | node:24.11.1-slim, postgres:17.6-alpine, redis:7.4-alpine, chrislusf/seaweedfs:3.97 (MinIO images unavailable)                                                          |

## Performance (lab, Apple M4)

- Analyzer: 5,000 synthetic files in 0.5 s; `@aws-sdk/client-s3` (439 files, 4,570 edges) in 229 ms, 257 MB peak RSS (`docs/benchmarks/analyzer.md`).
- Hosted: zod (525 files) 60 s end-to-end, dominated by archive download; analysis < 1 s (`docs/benchmarks/hosted.md`).
- Web: indexed search p95 33.8 ms at 1,000 nodes (target ≤ 150 ms); 5,000-node grouped graph first render 1.0 s, 45 MB heap (`docs/benchmarks/web.md`).
- Not measured: Core Web Vitals in the field, throttled devices, > 5,000-node graphs, concurrent hosted load.

## Model / ownership

Opus 5.5 led and built the analyzer, CLI, contracts, hosted API/worker/infrastructure and documentation, and independently re-verified frontend output. Sonnet 5.5 (High) built `apps/web` (M3 demo, M4 workspace, M6 site, E2E). Ultracode state could not be verified from inside the session.

## Remaining risks

- Anonymous management cookies are bearer capabilities; losing the cookie means losing delete rights until expiry.
- Quotas key on client IP (weak behind shared NAT; requires correct `TRUST_PROXY`).
- A store outage during submission returns 500 `internal` instead of 503.
- Dense-graph overview layout does not preserve left-to-right import direction (arrows still do).
- CSP allows `'unsafe-inline'` scripts (Next.js bootstrap).
- `archmap.json` demo data drifts as the repo changes; rerun `pnpm demo:data`.

## Recommended next iteration

1. Push to GitHub, run CI, fix platform-specific failures (Windows paths, symlink test).
2. Choose hosting (frontend, API, worker containers, managed Postgres/Redis/S3), apply the egress policy, deploy, run the smoke test against it.
3. Manual screen-reader and zoom pass; collect real-user Web Vitals.
4. Owner decisions: license, npm package name for `archmap`, public launch.
