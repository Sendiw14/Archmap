# Changelog

## Unreleased

- Hosted analysis: Fastify API, BullMQ worker, Postgres/Drizzle, S3 artifacts, public GitHub acquisition with safe extraction and isolated child-process analysis, anonymous management capability, quotas, 24 h retention, OpenAPI contract.
- Web: full workspace (`/analyses/[id]`, insights, files, report with JSON/Markdown/SVG export), editorial landing page, `/import`, docs, privacy, security; Playwright E2E with axe.
- CLI: installable bundled package (`pnpm build:cli`).
- Fixed: directory imports (`".."`, `"./"`) were unresolved; API/worker crashed on Postgres restart.

- Analysis engine: discovery, extraction, TypeScript-based resolution, graph schema 1.0.0, cycle/hotspot/unresolved findings.
- Local CLI: `analyze` (JSON/Markdown), `doctor`.
- 18 golden fixtures, security boundary tests, analyzer benchmark.
- Web demo (`/demo`) on real analyzer output with graph, inspector, cycles, potential impact and list view.
- graph-core: findings moved to Node-only `@archmap/graph-core/findings`; core algorithms are browser-safe.
