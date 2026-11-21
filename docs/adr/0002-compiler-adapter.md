# ADR-0002: Compiler adapter on ts-morph's bundled TypeScript 6

Status: Accepted (2026-11-21)

**Context.** Spec §4.2: start on a proven ts-morph/TypeScript 6 path; TypeScript 7 (native) changes the compiler API.

**Decision.** `packages/compiler-adapter` is the only importer of the TypeScript API (`import { ts } from "ts-morph"`, TS 6.0.2). It exposes `extractReferences` (syntax-only parse, no type checker) and `createResolver` (`ts.resolveModuleName`). Analyzer code depends only on these.

**Consequences.** A TS 7 adapter can be evaluated behind the same interface; migrate only when every golden fixture passes on it.
