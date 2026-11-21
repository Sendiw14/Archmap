# Contributing

1. `pnpm install`, then `pnpm test && pnpm typecheck && pnpm lint && pnpm format`.
2. Analyzer changes need a fixture in `fixtures/<name>/` with a hand-written `expected.json`.
3. Graph contract changes bump `SCHEMA_VERSION` and need an ADR in `docs/adr/`.
4. Update [docs/requirements/traceability.md](docs/requirements/traceability.md) when a requirement changes state; "Verified" needs a passing test.
5. Keep TypeScript erasable (no enums, namespaces, parameter properties) — sources run directly on Node.
