# ARCHMAP

Deterministic, evidence-backed dependency graphs for JavaScript and TypeScript repositories.

> Status: early development. The analysis engine and local CLI work; the web workspace and hosted import are not built yet. See [docs/status.md](docs/status.md).

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

## Development

`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT (pending maintainer confirmation) — see [LICENSE](LICENSE).
