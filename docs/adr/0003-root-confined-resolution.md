# ADR-0003: Root-confined virtual file system for module resolution

Status: Accepted (2026-11-21)

**Context.** Resolution must never read outside the repository, must be exact-case on case-insensitive file systems, and must not depend on `node_modules` being installed.

**Decision.** The resolver host answers `fileExists`/`directoryExists`/`readFile` only from the discovered in-root file set. `node_modules` is never scanned. Workspace packages are exposed as a virtual `<root>/node_modules/<name>` overlay mapped onto their source directories, so TypeScript applies `exports`/`imports`/`main`/`types`. If a workspace entry point is missing (e.g. `main: dist/...` not built), the resolver tries `source`, `src/index.*`, `index.*` and annotates the edge. Bare specifiers that are not workspace packages or path aliases become `external` nodes; Node builtins become `builtin:node:*`.
When no tsconfig sets `moduleResolution`, `bundler` semantics are assumed (documented limitation).

**Consequences.** Deterministic, secure, install-free analysis. Third-party package internals are never analyzed. `extends` pointing at packages in `node_modules` is reported as a config error.
