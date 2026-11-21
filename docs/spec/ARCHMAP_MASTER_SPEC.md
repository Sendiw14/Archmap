# ARCHMAP — FINAL CONSOLIDATED MASTER IMPLEMENTATION SPECIFICATION

**Project:** ARCHMAP — Visual Codebase Intelligence  
**Repository:** https://github.com/Sendiw14/Archmap  
**Specification baseline:** November 17, 2026  
**Project type:** Open-source developer tool, deterministic source analyzer, CLI and full-stack web application  
**Target release:** ARCHMAP v1.0  
**Primary design direction:** Exceptional, original, premium white-based UI/UX  
**Engineering standard:** Secure, maintainable, accessible, performant and evidence-verified  
**Document status:** Canonical implementation specification

---

# 0. ROLE, AUTHORITY AND EXECUTION MANDATE

Act as a coordinated senior software development team comprising:

- Product Architect and Technical Lead.
- Static Analysis and Compiler Engineer.
- Backend and Distributed Systems Engineer.
- Senior Frontend Engineer.
- Creative Director and UI/UX Designer.
- Interaction and Motion Designer.
- Security Engineer.
- Accessibility Specialist.
- QA and Test Automation Engineer.
- DevOps and Reliability Engineer.
- Open-Source Maintainer and Technical Writer.

Your mission is to take ARCHMAP from its actual repository state to a cohesive, tested, documented and deployable v1.0 implementation.

Do not merely produce recommendations, mockups, placeholder pages or disconnected demonstrations.

Follow this specification throughout planning, implementation, integration, verification and release preparation.

## 0.1 Source of truth

This document is the primary implementation authority.

Materialize it in the repository as:

`docs/spec/ARCHMAP_MASTER_SPEC.md`

Create a concise `CLAUDE.md` pointing to this specification, current architectural decisions, contribution rules and development status.

Avoid maintaining independently diverging copies of the full specification.

The authority hierarchy is:

1. This canonical master specification.
2. Approved, version-controlled amendments and Architecture Decision Records.
3. Versioned graph schemas and API contracts.
4. Approved design system and route specifications.
5. Requirements traceability register.
6. Task-specific instructions.

If two instructions conflict, resolve the conflict explicitly rather than silently choosing one.

Do not reinterpret an illustrative example as a mandatory requirement unless identified as such.

## 0.2 Non-negotiable principles

- Evidence over assumptions.
- Real functionality over simulation.
- Correctness over visual appearance.
- Security over convenience.
- Accessibility over purely aesthetic interactions.
- Explicit contracts over duplicated interpretation.
- Maintainability over unnecessary complexity.
- Measured performance over arbitrary claims.
- Original creative design over template cloning.
- Reproducibility over environment-dependent success.

Never claim perfect security, zero bugs, guaranteed performance or complete implementation without supporting evidence.

## 0.3 Working behavior

Begin by inspecting the repository, environment and available development tools.

Establish requirements, architecture and acceptance tests before major development.

After completing the specification and risk-validation gates, proceed through implementation milestones rather than repeatedly producing new plans.

Do not ask for approval for every ordinary engineering decision.

Use documented assumptions for reversible choices.

Require human confirmation for major irreversible actions, significant scope changes, paid infrastructure commitments, public release decisions and ownership-sensitive licensing choices.

If a capability is unavailable, record the blocker and implement the strongest verifiable local alternative without falsely reporting completion.

---

# 1. PRODUCT VISION AND BOUNDARIES

ARCHMAP is a **visual codebase intelligence platform** that analyzes supported source repositories and produces interactive, evidence-backed software architecture graphs.

Core workflow:

**Import repository → Analyze source → Build dependency graph → Explore relationships → Inspect findings → Export report.**

ARCHMAP should make unfamiliar codebases easier to understand.

## 1.1 Target users

Primary:

- Software engineers navigating unfamiliar repositories.
- Developers investigating module dependencies.
- Open-source contributors.
- Engineers working with TypeScript monorepos.

Secondary:

- Computer Science students.
- Technical leads.
- Software architecture educators.

## 1.2 Problems to solve

Users need reliable answers to:

- How is this codebase organized?
- What does this module depend on?
- What depends on this module?
- Are there circular dependencies?
- Which modules have unusually high coupling?
- Which files could be affected by a modification?
- How are workspace packages related?
- Where did each reported dependency originate?
- What parts of the repository could not be analyzed?

## 1.3 Product differentiation

ARCHMAP must combine:

1. Deterministic, inspectable source analysis.
2. An intuitive interactive graph explorer.
3. Source-backed relationship evidence.
4. Transparent diagnostic and limitation reporting.
5. A privacy-conscious local CLI.
6. A polished hosted demonstration.
7. Exceptional technical interface craftsmanship.

Do not market the analyzer as understanding all runtime behavior.

Static analysis can identify supported source-level relationships; it cannot guarantee complete knowledge of runtime dependencies or the consequences of code changes.

## 1.4 Success definition

A developer can analyze a supported repository, locate a module, inspect its dependencies, follow evidence, investigate a cycle, explore potential change impact and export a reproducible report.

The user must not need AI assistance to complete these tasks.

---

# 2. RELEASE STRATEGY AND APPROVED SCOPE

Separate implementation into two delivery stages without changing the final v1.0 requirements.

## 2.1 Core MVP — mandatory first milestone

Deliver:

- JavaScript/TypeScript analysis engine.
- Versioned dependency graph.
- Correct import resolution for supported cases.
- Circular dependency detection.
- Reverse dependency traversal.
- Reliable local CLI.
- Normalized JSON export.
- Markdown report.
- Interactive web demo using real analyzed fixtures.
- Basic graph workspace.
- Documentation and tests.

This must work before hosted ingestion infrastructure becomes a release priority.

## 2.2 Complete v1.0 — approved release scope

Add:

- Public GitHub repository import.
- Validated API.
- Asynchronous analysis jobs.
- Isolated workers.
- Temporary artifact persistence.
- Job progress and recovery.
- Full interactive graph workspace.
- Advanced search and filters.
- File inspector.
- Architecture insights.
- Change-impact investigation.
- Report exports.
- Complete editorial landing page.
- Full documentation site.
- Privacy and security information.
- Responsive and accessible interfaces.
- Performance, reliability and security verification.
- Production deployment configuration.

## 2.3 Deferred features

Do not implement these as v1 blockers:

- Private hosted repositories.
- Account authentication.
- Team workspaces.
- Realtime collaboration.
- Cross-language semantic analysis.
- AI architecture explanations.
- Automated code editing.
- IDE plugins.
- Runtime tracing.
- Repository monitoring.
- Billing.
- Complex organization administration.

Design extension points only where inexpensive and justified.

Do not introduce infrastructure for hypothetical future features.

---

# 3. DISCOVERY AND REQUIREMENTS BASELINE

Before major implementation, complete and commit:

- Product Requirements Document.
- Functional requirements register.
- Nonfunctional requirements register.
- Personas and user journeys.
- Route and page inventory.
- Supported language and syntax matrix.
- Graph schema.
- API contract.
- Threat model.
- Data classification and retention policy.
- Architecture diagrams.
- Design-system specification.
- Motion specification.
- Accessibility acceptance criteria.
- Performance benchmark methodology.
- Technology compatibility matrix.
- Architecture Decision Records.
- Risk register.
- Milestone dependency map.
- Definition of Done.

Use requirement IDs such as:

- `ANA-001` for analysis.
- `CLI-001` for command-line functionality.
- `API-001` for API functionality.
- `WEB-001` for website routes.
- `UX-001` for user journeys.
- `DES-001` for visual design.
- `MOT-001` for motion.
- `SEC-001` for security.
- `A11Y-001` for accessibility.
- `PERF-001` for performance.
- `OPS-001` for operations.
- `REL-001` for release requirements.

Every requirement must map to implementation, tests and verifiable evidence.

Use the states:

Proposed → Approved → Implementing → Implemented → Verified.

Also support Blocked and Deferred.

Only mark requirements Verified after successful validation.

---

# 4. TECHNOLOGY POLICY AND ARCHITECTURE

## 4.1 Preferred technology stack

| Domain | Technology |
|---|---|
| Runtime | Supported Node.js LTS |
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS 4.x and design tokens |
| UI primitives | Accessible custom components, Radix where justified |
| Icons | Lucide |
| Animation | Motion; limited GSAP where justified |
| Graph UI | React Flow |
| Graph layout | ELK.js |
| AST analysis | ts-morph with compatible TypeScript compiler |
| Graph algorithms | Dedicated TypeScript module |
| API | Fastify and Zod |
| Persistence | PostgreSQL and Drizzle |
| Background jobs | BullMQ and Redis |
| Graph artifacts | S3-compatible object storage |
| CLI | Node.js, TypeScript and Commander |
| Monorepo | pnpm workspaces |
| Unit/integration testing | Vitest |
| E2E testing | Playwright |
| Accessibility checks | axe-core and manual testing |
| Observability | Structured logging; OpenTelemetry where justified |
| Local infrastructure | Docker Compose |
| CI/CD | GitHub Actions |

Do not introduce additional languages, databases, framework ecosystems or orchestration platforms without a documented engineering justification.

## 4.2 Compatibility validation

Before installation, verify:

- Official stable releases.
- Runtime requirements.
- Dependency peer compatibility.
- Security advisories.
- Maintenance/support status.
- License compatibility.
- Deployment constraints.

Use supported patched versions and commit a lockfile.

Document selected versions and rationale.

Do not blindly use `latest`.

### TypeScript

TypeScript 7 introduces native implementation and compiler API changes.

Use a compiler adapter architecture.

Begin with a proven ts-morph/TypeScript 6-compatible analysis path.

Evaluate newer compiler APIs separately.

Do not migrate until golden fixtures and resolver behavior remain correct.

### React Flow

React Flow 13 is a candidate, not an automatic requirement.

Test custom nodes, controlled updates, React compatibility, layout, accessibility and performance.

Use the supported version that passes integration tests.

### Next.js

Use a maintained, patched version.

Verify caching semantics and server/client component boundaries.

Run linting independently in CI; never assume `next build` executes lint checks.

## 4.3 Architecture structure

Use:

    archmap/
      apps/
        web/
        api/
        worker/
        cli/
      packages/
        analyzer/
        compiler-adapter/
        graph-core/
        graph-schema/
        contracts/
        ui/
        config/
      fixtures/
      tests/
        integration/
        e2e/
        security/
        accessibility/
        performance/
      docs/
        spec/
        requirements/
        adr/
        architecture/
        design/
        security/
        benchmarks/
        workflow/
      infrastructure/
      .github/
      README.md
      CONTRIBUTING.md
      CODE_OF_CONDUCT.md
      SECURITY.md
      CHANGELOG.md
      LICENSE
      pnpm-workspace.yaml

## 4.4 Boundaries

The analyzer must not depend on:

- Next.js.
- React.
- Browser APIs.
- Hosting.
- Redis.
- PostgreSQL.
- UI libraries.

Graph algorithms must consume normalized graph contracts, not raw compiler ASTs.

The CLI must operate without hosted infrastructure.

The frontend must use versioned API and graph contracts.

Separate hosted ingestion, source analysis and artifact retrieval responsibilities.

Avoid circular package dependencies and hidden coupling.

---

# 5. ANALYSIS ENGINE SPECIFICATION

This is the technical foundation of ARCHMAP.

## 5.1 Repository discovery

Support:

- JavaScript and TypeScript applications.
- JSX and TSX.
- Single-package repositories.
- Common monorepo/workspace layouts.
- package.json.
- tsconfig/jsconfig configuration.
- Supported path aliases.
- Package exports/imports mappings.
- TypeScript project references where supported.

Respect source-selection rules.

Report ignored or unsupported files.

Never traverse outside the approved repository root.

Normalize paths consistently across macOS, Linux and Windows.

## 5.2 Source extraction

Support:

- Static imports.
- Static exports/re-exports.
- Type-only imports and exports.
- CommonJS require with static strings.
- Dynamic imports with literal strings.
- External package references.
- Unresolved imports.
- Unsupported dynamic expressions.

Resolve dependencies using compiler-aware logic.

Distinguish:

- Value/runtime imports.
- Type-only relationships.
- Static dynamic-import relationships.
- External package references.
- Unresolved references.

Do not guess unresolved targets.

Do not treat every source relationship as a guaranteed runtime dependency.

## 5.3 Graph schema

Create one versioned normalized graph representation.

### Analysis metadata

Include:

- Analysis ID.
- Repository identity.
- Immutable commit SHA when applicable.
- Analyzer version.
- Schema version.
- Configuration hash.
- Analysis status.
- Included/excluded file counts.
- Diagnostics.
- Timestamp.
- Scope and supported constructs.

### Nodes

Include:

- Stable ID.
- Node category.
- Normalized path.
- Package association.
- Language.
- Display name.
- Optional symbol information.
- Optional source location.

### Edges

Include:

- Stable ID.
- Source node.
- Target node when resolved.
- Dependency classification.
- Import kind.
- Source evidence.
- Resolution status.
- Optional diagnostic.
- Optional supporting references for aggregated edges.

**Required direction: importing module → imported module.**

Never reverse this convention between the engine, API and frontend.

### Findings

Include:

- Finding ID.
- Category.
- Severity or informational classification.
- Affected nodes.
- Evidence.
- Explanation.
- Algorithm/rule version.

Use documented scoring formulas for heuristic findings.

## 5.4 Algorithms

Implement and test:

- Incoming/outgoing dependency counts.
- Strongly connected components.
- Circular dependency reporting.
- Reverse reachability.
- Dependency path exploration.
- Package aggregation.
- Graph grouping.
- Deterministic hotspot metrics.

Use a correct SCC algorithm such as Tarjan or Kosaraju.

Distinguish an actual self-loop from a noncyclic singleton.

Differentiate cycles involving runtime dependencies from type-only relationships.

## 5.5 Change-impact interpretation

Report:

- Direct dependents.
- Transitive dependents.
- Dependency paths.
- Potentially affected packages.

Use the label **Potential change impact**.

Never imply that all dependent files will break or require modification.

## 5.6 Accuracy requirements

For all approved golden fixtures:

- Supported edges must match expected outputs.
- Supported cycles must be detected correctly.
- Unsupported constructs must receive diagnostics.
- Source evidence must point to valid references.
- Graph IDs and output ordering must be deterministic.
- Analysis failures must not appear as complete success.

Provide a structured coverage report showing which constructs were analyzed and which were not.

Do not claim complete architectural understanding.

## 5.7 Golden fixtures

Include at least one targeted fixture for every supported behavior, covering:

- ES modules.
- Re-exports.
- Barrel files.
- CommonJS.
- Type-only imports.
- Dynamic imports.
- Path aliases.
- Package exports.
- Monorepos.
- Circular dependencies.
- Self-loops.
- Project references.
- Unresolved modules.
- Malformed files.
- Case-sensitive paths.
- Empty repositories.
- Unsupported expressions.

Add larger realistic and synthetic fixtures for performance testing.

---

# 6. CLI AND LOCAL-FIRST EXPERIENCE

ARCHMAP must work as a standalone developer tool.

Proposed commands:

    archmap analyze .
    archmap analyze ./project --format json
    archmap analyze ./project --format markdown
    archmap analyze ./project --output report.json
    archmap doctor
    archmap --help
    archmap --version

Implement:

- Cross-platform operation.
- Clear input validation.
- Structured diagnostics.
- Exit codes.
- Configurable exclusion rules.
- Versioned output.
- Progress reporting.
- Deterministic JSON/Markdown exports.
- Helpful documentation.

Do not upload local source code.

Do not execute target repository scripts.

Do not require Redis, PostgreSQL or a hosted account.

The local CLI is a release-blocking feature.

---

# 7. HOSTED ANALYSIS ARCHITECTURE

## 7.1 Public GitHub import

Support public GitHub repositories through validated owner/repository identifiers.

Workflow:

1. Input URL.
2. Validate format.
3. Confirm public repository access.
4. Resolve immutable commit.
5. Check quotas.
6. Submit analysis.
7. Process in isolated worker.
8. Persist normalized graph.
9. Return result.
10. Expire artifacts.

Reject arbitrary URLs and unsupported Git providers in v1.

Avoid user-controlled redirects and arbitrary outbound requests.

Handle GitHub rate limits and service errors explicitly.

## 7.2 Security model

Repository content is untrusted.

Never execute:

- Repository JavaScript.
- npm install scripts.
- postinstall hooks.
- Build commands.
- Custom configuration code.
- Fetched binaries.
- Untrusted plugins.

Use controlled source acquisition and isolated analysis.

The worker must have:

- Restricted filesystem access.
- Bounded CPU/memory.
- Processing timeout.
- Limited or disabled network access.
- No privileged container access.
- No unnecessary secrets.

Use a separate acquisition component when network access is required.

## 7.3 Initial resource limits

Implement configurable, conservative defaults, subject to evidence-based tuning:

- Maximum compressed import: 50 MiB.
- Maximum extracted source: 200 MiB.
- Maximum discovered files: 10,000.
- Maximum parsed file: 2 MiB.
- Maximum analysis duration: 180 seconds.
- Per-job worker memory budget: approximately 1 GiB.
- Initial worker concurrency: two or fewer per deployment.
- Initial anonymous submission cap: five jobs per client per hour.

These are starting policy choices, not measured capacity guarantees.

Test them against representative repositories and hosting costs before production exposure.

Additional limits must cover archive nesting, output size, queue depth, request rate and concurrent jobs.

Provide understandable errors when limits are exceeded.

## 7.4 Job states

Support:

- Queued.
- Fetching.
- Analyzing.
- Persisting.
- Completed.
- Completed with limitations.
- Failed.
- Cancelled.
- Expired.

Define permitted transitions.

Make retries idempotent.

Do not fabricate progress percentages.

Handle worker restarts, cancellation, partial failures and cleanup.

## 7.5 Cache identity

Use:

- Repository identity.
- Commit SHA.
- Analyzer version.
- Graph schema version.
- Configuration hash.

Do not cache by branch name alone.

---

# 8. API, STORAGE AND AUTHORIZATION

## 8.1 Required API

Implement and document:

    POST   /v1/analyses
    GET    /v1/analyses/:id
    GET    /v1/analyses/:id/graph
    GET    /v1/analyses/:id/findings
    GET    /v1/analyses/:id/report
    POST   /v1/analyses/:id/cancel
    DELETE /v1/analyses/:id
    GET    /health/live
    GET    /health/ready

Use Zod and OpenAPI-compatible contracts.

Define complete request schemas, response schemas, status codes and errors.

Do not expose implementation details through error responses.

## 8.2 Anonymous management authorization

Viewing an analysis must be independent of managing it.

Use a strong, cryptographically random, per-analysis management capability for cancellation/deletion.

Requirements:

- At least 256 bits of randomness.
- Credential issued only to the original requester.
- Secure storage or suitably scoped HttpOnly cookie.
- Server stores an appropriate verifier, not the recoverable plaintext.
- Credential excluded from shareable URLs.
- Credential excluded from logs and analytics.
- Short expiration.
- Same-origin/CSRF protections for state-changing operations.
- Explicit error for missing/invalid management authorization.

Do not allow possession of an ordinary result URL alone to authorize deletion.

Document recovery limitations for anonymous sessions.

## 8.3 Persistence

Store durable metadata in PostgreSQL.

Use Redis/BullMQ for hosted job coordination.

Store large normalized graph artifacts in S3-compatible storage.

Implement:

- Migrations.
- Indexes.
- Unique constraints.
- Job idempotency.
- Artifact versioning.
- Transaction boundaries.
- Retention.
- Cleanup.
- Backups where applicable.
- Recovery procedures.

Avoid retaining raw source archives after analysis.

## 8.4 Privacy policy

### Local

Source code remains local.

No mandatory account or telemetry.

### Hosted

Public GitHub repositories only.

Clearly communicate that generated results are shareable.

Do not assume public repositories contain no sensitive material.

Minimize stored source excerpts.

Avoid storing entire source-file contents unless an explicit justified requirement exists.

Proposed result retention: 24 hours.

Verify expiration, cleanup and deletion behavior.

Use noindex directives for temporary analysis pages where appropriate.

No third-party AI transfer by default.

---

# 9. COMPLETE WEBSITE ARCHITECTURE

All required routes must be implemented.

Every page must include appropriate loading, error, empty and responsive states.

## 9.1 Global components

Implement:

- Header/navigation.
- Responsive menu.
- Footer.
- Breadcrumbs.
- Buttons.
- Input fields.
- Dialogs.
- Drawers.
- Search.
- Select/filter controls.
- Tooltips.
- Tabs.
- Badges.
- Notifications.
- Skeletons.
- Error boundaries.
- Accessible tables.
- Graph primitives.
- Consistent form validation.
- Keyboard shortcuts where justified.

Every applicable component needs hover, active, focus-visible, disabled, loading and error behavior.

## 9.2 Landing page `/`

Create an original, premium editorial experience.

Required sections:

1. Global navigation.
2. Expressive hero.
3. Interactive architecture-graph preview.
4. Product problem statement.
5. How ARCHMAP works.
6. Feature showcase.
7. Code-to-graph relationship storytelling.
8. Interactive dependency exploration showcase.
9. Cycle detection and architecture insights.
10. CLI/local-first section.
11. Privacy and trust explanation.
12. Real product demo section.
13. FAQ.
14. Final CTA.
15. Footer.

Hero direction:

**See the architecture behind your code.**

Use strong typography, a refined white canvas and an original dependency visualization.

The first screen must clearly communicate the product's value.

Do not use false testimonials, fabricated statistics, nonfunctional CTAs or stock-style visual filler.

## 9.3 Demo `/demo`

Use real, precomputed and documented analysis fixtures.

Required features:

- Guided walkthrough.
- Sample selection.
- Graph interaction.
- Node selection.
- Edge evidence.
- Search/filter.
- Cycle investigation.
- Impact demonstration.
- Reset.
- Import CTA.

No account required.

Clearly identify demonstration data.

## 9.4 Import `/import`

Include:

- Repository URL input.
- Format validation.
- Supported repository guidance.
- Advanced supported options.
- Privacy statement.
- Resource limitations.
- Submit state.
- Queue/progress state.
- Errors and recovery.
- Link to CLI instructions.

## 9.5 Main workspace `/analyses/[id]`

This is the primary product interface.

### Header

- Repository identity.
- Commit SHA.
- Analysis status.
- Analyzer version.
- Timestamp.
- Share.
- Export/report.
- Help.

### Left panel

- File/package tree.
- Search.
- Filters.
- Expand/collapse.
- Package grouping.
- Keyboard navigation.

### Graph canvas

- Pan.
- Zoom.
- Zoom to fit.
- Reset.
- Node selection.
- Edge selection.
- Dependency highlighting.
- Direction filters.
- Grouping.
- Layout.
- Legend.
- Search highlighting.
- Large-graph aggregation.
- Responsive controls.

### Right inspector

- Node details.
- File path.
- Language.
- Package.
- Incoming dependencies.
- Outgoing dependencies.
- Evidence.
- Findings.
- Potential impact.
- Copy actions.

### Workspace utilities

- Panel collapse.
- Resizing where practical.
- Full-screen graph.
- Graph/list switch.
- Error recovery.
- Persistent navigation behavior within the current analysis.

The workspace must remain usable without hover-dependent interaction.

## 9.6 Insights `/analyses/[id]/insights`

Include:

- Repository metrics.
- Dependency cycles.
- Coupling summaries.
- Hotspots.
- Package relationships.
- Unresolved dependencies.
- Diagnostics.
- Evidence.
- Methodology/limitations.

## 9.7 Files `/analyses/[id]/files`

Include:

- Searchable file tree.
- File metadata.
- Imports/exports.
- Source references.
- Dependency details.
- Supported symbol information.
- Unresolved import information.
- Navigation to graph nodes.

Do not claim full semantic symbol understanding for unsupported constructs.

## 9.8 Reports `/analyses/[id]/report`

Include:

- Repository identity.
- Commit.
- Analyzer/schema versions.
- Scope.
- Summary.
- Findings.
- Cycles.
- Diagnostics.
- Limitations.
- Exports.

Required formats:

- JSON.
- Markdown.
- Sanitized SVG when graph export is supported.

## 9.9 Documentation

Implement:

- `/docs`
- `/docs/getting-started`
- `/docs/cli`
- `/docs/architecture`
- `/docs/analysis-coverage`
- `/docs/troubleshooting`

Include actual setup instructions, examples, algorithms, limitations, output schemas and troubleshooting guidance.

## 9.10 Supporting routes

Implement:

- `/privacy`
- `/security`
- Not-found page.
- Failed-analysis state.
- Expired-analysis state.
- Unsupported-repository state.
- Rate-limit state.
- Worker-unavailable state.

Avoid meaningless placeholder pages.

---

# 10. WHITE-BASED DESIGN SYSTEM AND CREATIVE QUALITY

ARCHMAP must deliver an exceptionally polished technical product interface.

The design should feel:

- Premium.
- Original.
- Precise.
- Calm.
- Confident.
- Editorial.
- Interactive.
- Technically sophisticated.

## 10.1 Base palette

Use a white-dominant scheme.

Initial tokens:

- Background: `#FFFFFF`
- Surface: `#F7F9FC`
- Elevated surface: `#F1F5FB`
- Text: `#151B2B`
- Secondary text: `#526079`
- Borders: `#E2E8F0`
- Primary accent: `#476CF0`
- Secondary accent: `#8D85F6`

Define accessible semantic variants for error, warning, success, focus, selection and graph categories.

Validate actual contrast instead of assuming the palette is accessible.

## 10.2 Typography

Use a deliberate three-part typography system:

- Distinctive editorial display typography.
- Highly legible UI typography.
- Monospaced technical typography.

Possible fonts include Sora, Inter and JetBrains Mono, subject to actual design suitability and licensing.

Use responsive type scales and appropriate line lengths.

Do not sacrifice readability for stylistic novelty.

## 10.3 Layout

Define:

- Spacing scale.
- Grid.
- Container widths.
- Responsive breakpoints.
- Border system.
- Radius scale.
- Shadow/elevation scale.
- Component densities.
- Z-index rules.
- Typography hierarchy.

Marketing pages may use expressive composition.

The analysis workspace must prioritize efficiency and discoverability.

## 10.4 Assets

Use:

- Original architecture illustrations.
- Custom SVG graphics.
- Real graph previews.
- Meaningful code examples.
- Technical diagram motifs.
- Consistent icons.
- Purposeful visual transitions.

Avoid generic stock imagery, unlicensed assets and fake screenshots.

Do not use 3D simply to appear modern.

## 10.5 Creative benchmarking

Benchmark design principles from outstanding developer and editorial websites.

Study:

- Hierarchy.
- Layout composition.
- Typography.
- Interaction quality.
- Motion choreography.
- Responsiveness.
- Visual storytelling.
- Product demonstration.

Apply principles creatively without copying branded layouts or proprietary assets.

## 10.6 Design quality evidence

For each important route, provide:

- Wireframe or approved visual specification.
- Component inventory.
- Desktop screenshot.
- Mobile screenshot.
- Interaction checklist.
- Accessibility notes.
- Visual regression result.

Review the whole site, not only the hero.

---

# 11. INTERACTION AND MOTION SYSTEM

Use one coherent motion language.

Motion must provide visual feedback, explain relationships or support storytelling.

## 11.1 Required categories

- Page entrances.
- Section reveals.
- Hover/focus feedback.
- Navigation transitions.
- Panel transitions.
- Graph node selection.
- Dependency highlighting.
- Graph re-layout.
- Loading feedback.
- Error/success feedback.

## 11.2 Initial duration guidelines

- Buttons: 120–180ms.
- Node selection: 100–180ms.
- Edge highlighting: 150–250ms.
- Panel transitions: 180–260ms.
- Section reveals: 350–550ms.
- Hero choreography: 600–900ms.
- Graph layout transitions: 300–600ms.

Adjust through actual testing.

## 11.3 Animation contracts

Document:

- Trigger.
- Initial state.
- Final state.
- Easing.
- Duration.
- Sequence.
- Cancellation behavior.
- Reduced-motion behavior.
- Responsive behavior.
- Performance impact.

Prefer transform and opacity animation.

Avoid scroll hijacking in the workspace.

Never create hidden content that stays invisible when animation initialization fails.

Disable unnecessary motion under `prefers-reduced-motion`.

## 11.4 Motion acceptance

Verify:

- No broken triggers.
- No stuck invisible elements.
- No scroll locking.
- No repeated unintended entrance animations.
- No interaction-blocking transitions.
- No excessive layout shift.
- No loss of keyboard focus.
- Smooth graph state changes on supported hardware.

---

# 12. RESPONSIVENESS AND ACCESSIBILITY

Target WCAG 2.2 AA.

## 12.1 Test widths

Validate at representative widths:

- 360px.
- 390px.
- 430px.
- 768px.
- 1024px.
- 1440px.
- 1920px.

## 12.2 Workspace adaptation

Mobile must support:

- Searchable file/dependency lists.
- Simplified graph.
- Collapsible inspector.
- Accessible navigation.
- Touch-friendly controls.
- No mandatory precision dragging.

Tablet must support adaptive panels.

Desktop must support efficient multi-panel exploration.

## 12.3 Accessibility

Implement:

- Semantic HTML.
- Accessible headings/landmarks.
- Keyboard navigation.
- Visible focus.
- Correct dialog focus handling.
- Accessible forms.
- Announced status updates.
- Contrast compliance.
- Touch targets.
- Reduced motion.
- Screen-reader support.
- Alternative graph table/list.
- Zoom and reflow support.

Graph visualization must not be the only way to inspect essential relationships.

Automated tests must be supplemented by manual keyboard and screen-reader checks.

---

# 13. PERFORMANCE REQUIREMENTS

Performance must be measured, not claimed.

## 13.1 Core Web Vitals

At p75 on representative user conditions, target:

- LCP ≤2.5s.
- INP ≤200ms.
- CLS ≤0.1.

Use both laboratory and real-user measurements when available.

Do not substitute a Lighthouse score for field metrics.

## 13.2 Graph benchmarks

Use fixtures with:

- 100 nodes.
- 500 nodes.
- 1,000 nodes.
- 5,000 nodes.
- A larger stress-test graph.

Initial target:

- Indexed search on the 1,000-node reference graph: p95 ≤150ms.

Document the reference device, CPU, browser, dataset, warm/cold conditions and measurement method.

For 5,000+ nodes, prioritize grouping, filtering and progressive detail.

Use Web Workers for computationally expensive layout or transformations when beneficial.

## 13.3 Analyzer benchmarks

Benchmark projects with approximately:

- 100 source files.
- 1,000 source files.
- 5,000 source files.

Record:

- Scanning time.
- Parsing time.
- Resolution time.
- Graph construction time.
- Algorithm runtime.
- Serialization time.
- Peak memory.
- Total duration.

Set final release budgets after representative measurements.

Do not fabricate timing targets that the hardware cannot support.

## 13.4 Performance engineering

Use:

- Code splitting.
- Lazy graph loading.
- Efficient caching.
- Memoization.
- Indexed searches.
- Progressive rendering.
- Font optimization.
- Optimized static assets.
- Controlled animation work.
- Efficient state updates.

Test production builds under explicit browser and hardware profiles.

---

# 14. SECURITY AND PRIVACY VERIFICATION

Use applicable controls from OWASP ASVS 5.0.0, OWASP Top 10:2025 and secure-development practices informed by NIST SSDF.

## 14.1 Threat model

Assess:

- SSRF.
- Archive traversal.
- Symlink escape.
- Untrusted configuration.
- Source execution.
- Resource exhaustion.
- Zip/decompression bombs.
- HTML/script injection.
- SVG injection.
- Unauthorized job management.
- Rate-limit abuse.
- Secret leakage.
- Dependency compromise.
- CI compromise.
- Insecure artifact access.
- Worker isolation failures.

## 14.2 Mandatory controls

Implement:

- Strict repository identifier validation.
- Allowlisted GitHub acquisition.
- Redirect validation.
- Safe extraction.
- Resource budgets.
- Sandboxed execution.
- No repository code execution.
- Output escaping/sanitization.
- Secure headers.
- CSRF/authorization protections.
- Rate limiting.
- Audit-safe logs.
- Secure secret handling.
- Retention and deletion.
- Dependency and workflow security checks.

Security tests must include adversarial input fixtures.

No known critical or high-severity release-relevant vulnerability may remain unresolved for production release.

## 14.3 Data boundaries

Local source stays local.

Hosted mode accepts public GitHub repositories only.

Do not forward source code to AI providers.

Do not store full source archives indefinitely.

Document the actual data-flow and retention implementation.

---

# 15. RELIABILITY, OBSERVABILITY AND OPERATIONS

Implement:

- Structured logs.
- Request/job correlation IDs.
- Queue metrics.
- Processing duration metrics.
- Worker health.
- Failure counts.
- Resource usage monitoring.
- Readiness/liveness endpoints.
- Job retries.
- Idempotency.
- Cancellation.
- Timeout handling.
- Expiration.
- Recovery after worker termination.

Do not log full source contents or secrets.

Provide operational documentation for:

- Setup.
- Migrations.
- Environment variables.
- Secrets.
- Backups.
- Recovery.
- Rollback.
- Cost monitoring.
- Incident response.
- Worker operations.
- Artifact cleanup.

Use a safe-disable mechanism for public imports if infrastructure or abuse conditions threaten service stability.

Do not promise unverified uptime guarantees.

---

# 16. MULTI-MODEL DEVELOPMENT ORCHESTRATION

Use multiple models according to actual capability, task risk and resource cost.

All models must operate under this single specification.

## 16.1 Preferred model assignments

### Frontend and creative development

**Model:** Claude Sonnet 5.5  
**ID:** `claude-sonnet-5-5`  
**Reasoning effort:** High  
**Ultracode:** Enabled when supported and beneficial.

Responsibilities:

- Design system.
- Landing page.
- All website routes.
- UI components.
- Motion.
- Graph workspace.
- Responsive behavior.
- Frontend accessibility.
- Visual QA.
- Frontend performance.

### Architecture and backend development

**Model:** Claude Opus 5.5  
**ID:** `claude-opus-5-5`  
**Reasoning effort:** Medium  
**Ultracode:** Enabled when supported and beneficial.

Responsibilities:

- Architecture decisions.
- Analysis engine.
- Compiler compatibility.
- Dependency resolution.
- Graph algorithms.
- CLI.
- API.
- Database.
- Workers.
- Security.
- Reliability.
- Infrastructure.

Escalate Opus to High for difficult root-cause debugging, high-risk security review or especially challenging compiler/architecture work.

## 16.2 Configuration verification

Before assigning tasks:

- Verify Claude Code version.
- Verify model access.
- Verify effective effort.
- Verify Ultracode state.
- Verify agent/team capabilities.
- Verify account restrictions and permissions.

For Claude Code v2.1.284 or later, configure Ultracode as a separate toggle while retaining High/Medium effort where supported.

Do not use a configuration shortcut that unintentionally changes the effort to `xhigh`.

If unsupported, use the closest appropriate verified configuration and document the substitution.

## 16.3 Orchestrator

Preferred lead: Opus 5.5.

Responsibilities:

- Maintain task dependencies.
- Assign work.
- Approve shared contracts.
- Prevent conflicting edits.
- Coordinate merges.
- Review architecture drift.
- Control milestone gates.
- Track test evidence.
- Report blockers.

The orchestrator must delegate work rather than attempting every task itself.

## 16.4 Ownership

| Domain | Primary owner | Independent reviewer |
|---|---|---|
| Requirements and architecture | Opus | Sonnet / human |
| Analyzer and compiler adapter | Opus | Independent correctness reviewer |
| Graph algorithms | Opus | Independent test reviewer |
| CLI | Opus | Developer-experience reviewer |
| API and database | Opus | Contract/security reviewer |
| Workers and ingestion | Opus | Security/reliability reviewer |
| Design system | Sonnet | Accessibility reviewer |
| Landing page | Sonnet | Visual/UX reviewer |
| Graph workspace | Sonnet | Opus for semantics |
| Motion and responsive UI | Sonnet | Accessibility/performance reviewer |
| E2E tests | Sonnet | Opus |
| Integration/security tests | Opus | Independent reviewer |
| CI/CD | Opus | Relevant module owners |
| Final release assessment | Independent reviewer | Human project owner |

## 16.5 File ownership

Frontend agent primarily owns:

    apps/web/**
    packages/ui/**
    docs/design/**

Backend agent primarily owns:

    apps/api/**
    apps/worker/**
    apps/cli/**
    packages/analyzer/**
    packages/compiler-adapter/**
    packages/graph-core/**
    packages/graph-schema/**
    packages/contracts/**
    infrastructure/**
    docs/architecture/**
    docs/security/**

Shared files, dependency locks, specifications and CI configuration require coordinated ownership.

No simultaneous conflicting edits.

## 16.6 Parallel work

Use isolated branches/worktrees for genuinely independent tasks.

Parallelize:

- Design system and analyzer fixtures.
- Landing page and CLI.
- Documentation visuals and backend worker infrastructure.
- Independent test development.

Sequence:

- Graph contract before graph integration.
- API contract before frontend API integration.
- Threat model before hosted ingestion.
- Data model before persistence.
- Worker security before public deployment.

## 16.7 Task contract

Each task must specify:

- ID.
- Owner.
- Model.
- Effort.
- Ultracode state.
- Goal.
- Dependencies.
- Allowed paths.
- Prohibited paths.
- Relevant requirements.
- Contracts.
- Acceptance criteria.
- Tests.
- Expected outputs.
- Risks.

## 16.8 Handoff

Every agent handoff must report:

- Completed work.
- Files changed.
- Contract changes.
- Tests executed.
- Test results.
- Known limitations.
- Integration dependencies.
- Branch/commit.
- Next required action.

Do not accept "done" without evidence.

## 16.9 Integration checkpoints

Establish checkpoints after:

1. Architecture and contract approval.
2. Analyzer and CLI correctness.
3. Graph UI integration.
4. Hosted ingestion integration.
5. Complete website integration.
6. Final production verification.

Each checkpoint requires tests and a recorded decision.

## 16.10 Cost optimization

Use high-cost reasoning only where justified.

Routine documentation, formatting and simple tests may use a lower-cost supported model.

Complex architecture, security and compiler work should use a more capable model.

Avoid excessive parallel agents, redundant reviews and repeated context loading.

Never optimize cost by eliminating essential verification.

---

# 17. TESTING STRATEGY

Require multiple independent layers of verification.

## 17.1 Unit tests

Test:

- Parsers.
- Resolvers.
- Graph algorithms.
- Schemas.
- Validation.
- Utilities.
- CLI options.
- UI component state.

## 17.2 Golden correctness tests

Use exact expected outputs for supported analysis fixtures.

All approved correctness fixtures must pass before release.

## 17.3 Integration tests

Test:

- CLI and analyzer.
- API and database.
- API and queue.
- Queue and worker.
- Worker and object storage.
- Cancellation.
- Expiration.
- Schema compatibility.

## 17.4 E2E tests

Cover:

- Landing to demo.
- Demo exploration.
- Public import.
- Progress.
- Graph workspace.
- Search.
- Filters.
- Node/edge evidence.
- Insights.
- Change impact.
- Reports.
- Recovery.
- Expiration.

## 17.5 Accessibility tests

Use axe-core plus manual keyboard, screen-reader and zoom testing.

No unresolved serious/critical automated accessibility violations.

Document manual findings.

## 17.6 Security tests

Test:

- Archive traversal.
- Symlink escapes.
- Oversized imports.
- Resource limits.
- Unsafe redirects.
- Injection.
- Unauthorized deletion/cancellation.
- Secret handling.
- Worker isolation.
- Retry/expiration abuse.

## 17.7 Visual tests

Capture screenshots of all important routes, states and responsive layouts.

Compare against approved specifications.

Check:

- Typography.
- Spacing.
- Alignment.
- Overflow.
- Color.
- Contrast.
- Motion.
- Navigation.
- UI states.

## 17.8 Reliability tests

Simulate:

- Worker termination.
- Redis interruption.
- Database unavailability.
- GitHub rate limits.
- Artifact-storage failure.
- Job timeout.
- Duplicate submissions.
- Cancellation races.

## 17.9 Test evidence

For every release-gate test, record:

- Command.
- Environment.
- Dataset.
- Result.
- Failures.
- Artifacts.
- Relevant commit.

Never report tests as passed without executing them.

---

# 18. CI/CD AND DEPLOYMENT

## 18.1 Continuous integration

Create independent CI jobs for:

- Format.
- Lint.
- Type checking.
- Unit tests.
- Integration tests.
- Contract tests.
- Build.
- E2E.
- Accessibility.
- Security.
- Dependency review.

Run lint explicitly.

Protect secrets.

Use least-privilege GitHub Actions permissions.

Pin and review third-party workflow dependencies.

## 18.2 Local deployment

Provide reproducible development setup.

Use Docker Compose for:

- PostgreSQL.
- Redis.
- Object storage.
- API.
- Worker.

Frontend and CLI setup must be documented.

Provide offline demo fixtures that require no GitHub credentials.

## 18.3 Production architecture

Preferred separation:

- Next.js frontend.
- Long-running Fastify API.
- Isolated worker containers.
- PostgreSQL.
- Redis.
- S3-compatible storage.

Verify provider capabilities and pricing before choosing concrete hosting vendors.

Do not perform long-running untrusted analysis inside frontend request handlers.

## 18.4 Release process

Require:

- CI success.
- Migrations.
- Configuration validation.
- Secure secrets.
- Deployment smoke tests.
- Health checks.
- Rollback procedure.
- Tagged release.
- Release notes.
- Changelog.
- Monitoring verification.

Do not claim deployment without the endpoint and smoke-test results.

---

# 19. OPEN-SOURCE GOVERNANCE AND MAINTENANCE

Create:

- README.
- CONTRIBUTING.
- CODE_OF_CONDUCT.
- SECURITY.
- CHANGELOG.
- LICENSE.
- Issue templates.
- Pull request template.
- Architecture documentation.
- CLI documentation.
- API documentation.
- Graph schema reference.
- Performance benchmark reference.
- Development guide.
- Deployment guide.

Propose MIT as the initial project license, but verify ownership and dependency compatibility before publishing the final licensed release.

README must include real screenshots and functional examples.

Maintain:

- Dependency updates.
- Security advisory monitoring.
- Breaking-change policy.
- Schema versioning.
- Supported Node.js releases.
- Issue triage policy.
- Upgrade guides.
- Release notes.
- Compatibility testing.

Do not leave the project dependent on undocumented AI conversation history.

---

# 20. IMPLEMENTATION MILESTONES AND GATES

## M0 — Discovery and baseline

Deliver specifications, user journeys, threat model, architecture, route inventory, risk register and acceptance criteria.

**Gate:** No unresolved foundational contradiction.

## M1 — Compatibility and foundation

Deliver monorepo, tooling, CI, compiler proof, graph library proof and design foundations.

**Gate:** Reproducible setup and passing baseline tests.

## M2 — Analysis engine

Deliver scanner, resolver, graph schema, algorithms, diagnostics and golden fixtures.

**Gate:** Correctness suite passes.

## M3 — CLI and MVP

Deliver local CLI, exports and the initial working graph demo.

**Gate:** Supported repositories can be analyzed and explored without hosted infrastructure.

## M4 — Full workspace

Deliver interactive canvas, inspector, filters, insights, change-impact view and accessible alternative.

**Gate:** User journeys and graph performance tests pass.

## M5 — Hosted ingestion

Deliver public import, API, database, queue, isolated worker, authorization, expiration and recovery.

**Gate:** Security and integration tests pass.

## M6 — Creative website and documentation

Deliver every approved public route, landing-page section, animation, visual asset, demo and documentation page.

**Gate:** Visual, responsive and accessibility checks pass.

## M7 — Production validation

Deliver final test evidence, security audit, performance report, deployment configuration and release documentation.

**Gate:** All release-blocking requirements verified.

Do not skip gates.

If implementation reveals a necessary change, create an ADR and update the traceability register.

---

# 21. FINAL DEFINITION OF DONE

The final implementation must satisfy the following:

## Product completeness

- All v1 routes implemented.
- Primary journeys functional.
- Demo works.
- CLI works.
- Hosted public import works.
- Reports export correctly.
- No release-blocking placeholders.

## Analysis correctness

- Golden fixtures pass.
- Graph direction consistent.
- Cycles correct for supported cases.
- Unresolved imports visible.
- Evidence inspectable.
- Deterministic output verified.
- Limitations explicit.

## Frontend quality

- Consistent white-based identity.
- All major routes visually polished.
- Responsive layouts verified.
- Motion functional.
- No critical interaction failures.
- No broken navigation.
- No significant unresolved visual regressions.

## Accessibility

- WCAG 2.2 AA assessment performed.
- Keyboard navigation verified.
- Screen-reader alternatives usable.
- Reduced motion works.
- No unresolved critical accessibility barriers.

## Performance

- Core Web Vitals assessed.
- Graph benchmark recorded.
- Worker resource limits enforced.
- Large graphs navigable.
- No known uncontrolled memory/process growth.

## Security

- Threat model complete.
- Untrusted code not executed.
- Import protections verified.
- Authorization works.
- Retention works.
- No known unresolved critical/high release-relevant vulnerabilities.

## Reliability

- Retries work.
- Cancellation works.
- Expiration works.
- Worker failures recover safely.
- Health checks functional.
- Logs and metrics available.

## Delivery

- CI green.
- Setup reproducible.
- Documentation complete.
- License finalized.
- Release artifacts valid.
- Deployment verified where infrastructure is available.
- Traceability register complete.

A missing release-blocking requirement prevents a production-ready verdict.

---

# 22. FINAL END-TO-END AUDIT

Before completion, independently review:

- Product completeness.
- Scope consistency.
- UX quality.
- Visual originality.
- Every route and state.
- Accessibility.
- Motion.
- Static-analysis correctness.
- Graph algorithms.
- Architecture.
- API contracts.
- Database.
- Worker reliability.
- Security.
- Performance.
- Deployment.
- Open-source documentation.
- Long-term maintainability.
- Multi-model integration.
- Requirements traceability.

For every significant finding, provide:

- Severity.
- Evidence.
- Root cause.
- Affected requirement.
- Corrective action.
- Test.
- Residual risk.

Do not automatically approve the project because the master prompt is extensive.

---

# 23. FINAL OUTPUT REQUIREMENTS

At completion, provide:

1. Implementation summary.
2. Repository structure.
3. Important architecture decisions.
4. Implemented feature matrix.
5. Functional route inventory.
6. Actual selected dependency versions.
7. Model/task ownership summary.
8. Test execution report.
9. Analyzer correctness report.
10. Security review report.
11. Accessibility findings.
12. Performance benchmark results.
13. Deployment status.
14. Documentation status.
15. Unimplemented/deferred items.
16. Outstanding bugs.
17. Remaining risks.
18. Recommended next iteration.
19. Evidence-based release-readiness verdict.

Clearly distinguish:

- Implemented.
- Tested.
- Verified.
- Incomplete.
- Blocked.
- Deferred.

Never treat these statuses as interchangeable.

---

# 24. FINAL EXECUTION DIRECTIVE

Build ARCHMAP as one cohesive, exceptional, modern developer product.

It must combine:

- Technically trustworthy static analysis.
- A precise and versioned architecture graph.
- A genuinely useful local CLI.
- Safe public repository analysis.
- A premium interactive workspace.
- Original white-based editorial design.
- Purposeful animations.
- Clear and accessible user journeys.
- Secure and maintainable engineering.
- Reliable integration between frontend and backend.
- Complete documentation.
- Evidence-backed release verification.

Use Claude Sonnet 5.5 High for frontend and creative implementation, and Claude Opus 5.5 Medium for backend and complex architecture work, with Ultracode enabled where supported and advantageous.

Verify model configurations, toolchain versions and integration capabilities before using them.

Maintain one canonical specification, shared contracts, clear task ownership, reviewable handoffs and explicit integration checkpoints.

Prioritize source-analysis correctness, real functionality and security without compromising the ambition of the visual experience.

**The final product should demonstrate professional-level engineering and exceptional design craftsmanship.**

**Do not declare success merely because every planned file exists or the application builds. Only declare a requirement complete when its intended behavior has been verified.**

**Begin with repository inspection, M0 requirements reconciliation and M1 compatibility validation. Then implement in dependency order until the approved deliverables are complete or a clearly documented external blocker prevents further progress.**
