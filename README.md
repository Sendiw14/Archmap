# ARCHMAP

Deterministic, evidence-backed dependency graphs for JavaScript and TypeScript repositories.

> Status: v1.0 feature-complete and verified locally; not yet deployed or released. See [docs/status.md](docs/status.md).

## Quick start

```bash
pnpm install
pnpm archmap analyze path/to/repo -f markdown
pnpm archmap analyze path/to/repo -o graph.json --reproducible
```

Requires Node.js ≥ 22.18 and pnpm 9.

## What it does

- Parses source (no type checking, **no code execution**) and resolves imports with TypeScript's own module resolution, honoring `tsconfig` paths, package `exports`, workspace packages and project references.
- Emits a versioned graph (`schemaVersion 1.0.0`): file / external / builtin nodes, one edge per import statement (importer → imported) with source evidence, runtime vs type-only classification and resolution status.
- Reports runtime cycles, type-only cycles, coupling hotspots, unresolved imports and diagnostics for anything it could not analyze.
- Never reads outside the repository root and never uploads anything.

See [analysis coverage](docs/architecture/analysis-coverage.md) for exactly what is and is not supported.

## CLI

```
archmap analyze [path] [-f json|markdown] [-o file] [-e glob...] [--max-files n] [--max-file-bytes n] [--reproducible] [-q]
archmap doctor
```

Exit codes: `0` success (including "completed with limitations"), `1` analysis failure, `2` invalid input.

## Web app and hosted analysis

```bash
pnpm --filter @archmap/api dev:memory        # offline API on :4000 (analyzes archmap-fixtures/<name>)
pnpm --filter @archmap/web build && pnpm --filter @archmap/web start   # http://localhost:3000
```

Full stack with Postgres, Redis and S3-compatible storage: `docker compose -f infrastructure/docker-compose.yml up -d --build` (API on :4100; rebuild web with `ARCHMAP_API_URL=http://localhost:4100`). Operations: [docs/architecture/operations.md](docs/architecture/operations.md). API: [docs/api/openapi.json](docs/api/openapi.json).

Hosted mode accepts **public GitHub repositories only**, never runs repository code, and deletes results after 24 hours.

## Installable CLI

`pnpm build:cli` produces a publishable package in `apps/cli/dist` (`npm pack apps/cli/dist`).

## Development

`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
