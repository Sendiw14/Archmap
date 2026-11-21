# ADR-0001: pnpm monorepo, TypeScript sources executed directly

Status: Accepted (2026-11-21)

**Context.** Spec §4.3 mandates a pnpm monorepo. A build step per package adds config and drift between `src` and `dist`.

**Decision.** Workspace packages export `./src/index.ts`. Node ≥ 22.18 runs them via native type stripping; `tsconfig` enforces `erasableSyntaxOnly` and `.ts` import extensions. Vitest consumes the same sources.

**Consequences.** No build needed for dev, tests or the local CLI. Publishing the CLI to npm will need a bundle step (CLI-007). Enums, namespaces and parameter properties are disallowed.
