# ARCHMAP — agent guide

- **Canonical spec:** [docs/spec/ARCHMAP_MASTER_SPEC.md](docs/spec/ARCHMAP_MASTER_SPEC.md). Do not copy it elsewhere; amend via ADRs.
- **Status & milestones:** [docs/status.md](docs/status.md). **Requirements register:** [docs/requirements/traceability.md](docs/requirements/traceability.md).
- **Decisions:** [docs/adr/](docs/adr/). Record a new ADR for any change to contracts, toolchain or scope.

## Invariants (never break)

- Edge direction is **importing module → imported module** everywhere (engine, API, UI).
- Graph contract lives in `packages/graph-schema`; bump `SCHEMA_VERSION` on any change.
- Only `packages/compiler-adapter` imports the TypeScript API.
- The analyzer never reads outside the repository root, never follows symlinks, never executes repository code.
- Output (ids, ordering) is deterministic; `--reproducible` must stay byte-identical across runs.
- A requirement is **Verified** only with an executed test or recorded evidence.

## Commands

```
pnpm install
pnpm test        # vitest: golden fixtures, algorithms, CLI, security
pnpm typecheck && pnpm lint && pnpm format
pnpm archmap analyze <path> [-f json|markdown] [-o file] [-e glob] [--reproducible]
pnpm --filter @archmap/api dev:memory   # offline API (fixtures)
pnpm --filter @archmap/web test:e2e     # Playwright + axe
ARCHMAP_IT=1 pnpm vitest run tests/integration   # needs infrastructure/docker-compose.yml
pnpm openapi && pnpm build:cli && pnpm demo:data
```

Node ≥ 22.18 (runs TypeScript sources via native type stripping; erasable syntax only — no enums/namespaces/parameter properties).

## Ownership (spec §16)

Backend/analyzer/CLI/infra: Opus. `apps/web`, `packages/ui`, `docs/design`: Sonnet (High). Shared files (lockfile, CI, spec) need coordination.

## Adding analyzer behavior

Add a fixture under `fixtures/<name>/` with a hand-written `expected.json`, then implement until `pnpm test` passes.
