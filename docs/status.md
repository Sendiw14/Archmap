# Development status

_Last updated: 2026-11-21._

| Milestone                     | State               | Gate evidence                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Discovery & baseline       | Partial             | Spec, register, ADRs, threat model (analyzer scope), architecture overview committed. Missing: PRD/personas/journeys, route inventory, design & motion specs, API contract, data-retention policy.                                                                                                                      |
| M1 Compatibility & foundation | Partial             | pnpm monorepo, format/lint/typecheck/test, CI workflow. Compiler proof done (TS 6.0.2 via ts-morph). Missing: React Flow / ELK proof, design foundations, Next.js app. CI not yet run on GitHub.                                                                                                                        |
| M2 Analysis engine            | Gate passed locally | 17 + 1 golden fixtures, determinism, schema validation, evidence checks.                                                                                                                                                                                                                                                |
| M3 CLI & MVP                  | Gate passed locally | CLI (`cli.test.ts`); `/demo` on real analyzer output (`pnpm demo:data`), React Flow 13 + ELK (Web Worker), inspector, evidence, search, filters, cycles, potential impact, list alternative, mobile drawer. `pnpm test` 86/86, web build OK, manual browser check at 1440/768/360 px. No axe or screen-reader pass yet. |
| M4–M7                         | Not started         | —                                                                                                                                                                                                                                                                                                                       |

## Compatibility matrix (selected, verified installed)

| Component                             | Version                   | Notes                                                         |
| ------------------------------------- | ------------------------- | ------------------------------------------------------------- |
| Node.js                               | 24.11.1 local; CI 22 & 24 | Requires ≥ 22.18 (type stripping).                            |
| pnpm                                  | 9.15.9                    | `packageManager` pinned.                                      |
| ts-morph                              | 28.0.0                    | Bundles TypeScript **6.0.2** — this is the analysis compiler. |
| typescript (dev)                      | 6.0.3                     | Type checking only. TS 7 deliberately not used (ADR-0002).    |
| zod                                   | 4.x (^4.6.7)              | Graph schema.                                                 |
| commander                             | 15.x (^15.1.0)            | CLI.                                                          |
| vitest                                | 5.1.1                     | Tests.                                                        |
| eslint / typescript-eslint / prettier | 10.x / 8.x / 3.x          |                                                               |
| next / react                          | 16.4.6 / 19.3.1           | Web; Google Fonts fetched at build time.                      |
| @xyflow/react / elkjs                 | 13.0.2 / 0.12.1           | v13 API differences noted in docs/design/m3-demo.md.          |
| tailwindcss / lucide-react            | 4.3.5 / 1.77.0            |                                                               |

`pnpm audit --audit-level high`: no known vulnerabilities (2026-11-21).

## Open items / blockers

- GitHub remote not configured locally; CI unverified until pushed.
- Multi-model orchestration (spec §16): this baseline was produced by a single Opus 5.5 session; Ultracode state not verifiable from inside the session. The M3 web demo was built by a Sonnet 5.5 (High) subagent and reviewed and re-verified by the Opus lead.
- LICENSE is MIT as proposed by the spec; owner must confirm before public release.
