# ARCHMAP product requirements (v1.0)

Derived from the canonical spec (`docs/spec/ARCHMAP_MASTER_SPEC.md` §1–2). Requirement IDs and their states live in [traceability.md](traceability.md); this document explains who the product is for and how they use it.

## Problem

Engineers joining an unfamiliar JavaScript/TypeScript codebase cannot quickly answer: what depends on this module, what does it depend on, where are the cycles, what could a change affect, and which parts could not be analyzed at all. Existing answers come from reading code by hand or from tools whose output cannot be traced back to source lines.

## Product

A deterministic analyzer that turns source into a versioned dependency graph where every edge points to the line that created it, delivered three ways:

| Surface                   | For                               | Data leaves the machine?                                                        |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| CLI (`archmap analyze`)   | Any repository, including private | No                                                                              |
| Hosted import (`/import`) | Public GitHub repositories        | Yes: public source is downloaded and analyzed; the result is shareable for 24 h |
| Demo (`/demo`)            | Evaluating ARCHMAP                | No (bundled real analyses)                                                      |

Out of scope for v1 (spec §2.3): private hosted repositories, accounts, collaboration, AI explanations, runtime tracing, other languages.

## Personas

| Persona                           | Context                                        | Primary need                                            | Success looks like                                                                               |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Priya, new team member**        | Joined a TypeScript monorepo last week         | Orientation: packages, entry points, what talks to what | Finds the module behind a bug and its callers in minutes, without asking                         |
| **Marcus, maintainer**            | Reviews a refactor that moves a shared utility | Potential change impact with evidence                   | Lists every direct and transitive dependent with the import lines, and knows which are type-only |
| **Lena, open-source contributor** | Evaluating a public repo before contributing   | Quick read-only overview, no install                    | Pastes a GitHub URL, shares the result link in an issue                                          |
| **Sam, tech lead**                | Paying down architecture debt                  | Cycles, coupling hotspots, unresolved imports           | Exports a report listing runtime cycles with evidence for a planning doc                         |
| **Dr. Okafor, educator**          | Teaches software architecture                  | Concrete, explorable examples                           | Uses the demo and fixtures in a lecture; students explore via keyboard/list view                 |

## Journeys (each is covered by E2E tests; see `apps/web/e2e/`)

1. **Evaluate** (Lena, Okafor): landing → `/demo` → pick sample → select a module → read evidence → open a cycle → reset.
2. **Analyze locally** (Priya, Sam): install CLI → `archmap analyze .` → read Markdown report → `--format json` for tooling.
3. **Analyze a public repo** (Lena): `/import` → paste URL → watch real status phases → workspace → share link. Errors give a reason and a next step (invalid input, private repo, rate limit, outage).
4. **Investigate impact** (Marcus): workspace → search module → inspector "Potential change impact" → follow paths → files view for evidence.
5. **Report** (Sam): insights (cycles, hotspots, unresolved, diagnostics, methodology) → report → download JSON/Markdown/SVG.
6. **Accessible exploration** (Okafor's students): list view and file tree by keyboard; every relationship reachable without the canvas.
7. **Clean up** (Lena): creator deletes the analysis; others with the link cannot.

## Product principles

- Every claim is backed by a source location; unsupported constructs are reported, never guessed.
- "Potential change impact", never "will break".
- The same analyzer runs everywhere; hosted mode adds isolation, not different results (cache key includes analyzer version).

## Risk register

| ID  | Risk                                         | Likelihood        | Impact   | Mitigation                                                                                                     | Owner      | Status                   |
| --- | -------------------------------------------- | ----------------- | -------- | -------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------ |
| R1  | Users read static edges as runtime truth     | Medium            | Medium   | "Potential change impact" wording; runtime vs type-only classes; limitations on every report                   | Product    | Mitigated                |
| R2  | Resolver mistakes on real repos              | Medium            | High     | Golden fixtures; real-package benchmark (caught directory-import bug); unresolved edges are listed, not hidden | Analyzer   | Mitigated, ongoing       |
| R3  | Malicious archives (traversal, bombs, links) | Medium            | High     | Safe extraction with budgets; adversarial tests                                                                | Backend    | Mitigated                |
| R4  | Untrusted code execution                     | Low               | Critical | Syntax-only parsing, no installs/builds; child process with empty env                                          | Backend    | Mitigated                |
| R5  | Abuse / cost spikes on hosted imports        | Medium            | Medium   | Per-client quota, rate limit, queue cap, `IMPORTS_ENABLED` switch                                              | Ops        | Mitigated                |
| R6  | Worker egress not restricted                 | Medium            | Medium   | Deployment network policy (ADR-0005)                                                                           | Ops        | **Open** (needs hosting) |
| R7  | GitHub rate limits / outages                 | Medium            | Low      | Retries, `github_unavailable` messaging, optional `GITHUB_TOKEN`                                               | Ops        | Mitigated                |
| R8  | Lost management cookie                       | Medium            | Low      | 24 h expiry; documented limitation                                                                             | Product    | Accepted                 |
| R9  | TypeScript 7 compiler API changes            | High (eventually) | Medium   | Compiler adapter boundary (ADR-0002)                                                                           | Analyzer   | Mitigated                |
| R10 | Upstream image availability (e.g. MinIO)     | Medium            | Low      | Pinned SeaweedFS; S3 API only                                                                                  | Ops        | Mitigated                |
| R11 | Accessibility gaps not caught by automation  | Medium            | Medium   | axe on all routes; manual screen-reader pass                                                                   | Frontend   | **Open**                 |
| R12 | Unverified on GitHub CI / Windows            | Medium            | Medium   | Linux verified in containers; CI defined                                                                       | Maintainer | **Open** (needs remote)  |
| R13 | License/ownership unconfirmed                | Low               | High     | MIT proposed                                                                                                   | Owner      | **Open**                 |
