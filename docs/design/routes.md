# Route index: M4 full workspace and M6 website

Scope: every route in spec 9, with purpose, states, components, interaction checklist, accessibility notes and screenshots.
Screenshots are in `docs/design/screenshots/` (`<name>-desktop.png` at 1440 px, `<name>-mobile.png` at 390 px), captured by
`SCREENSHOTS=1 pnpm --filter @archmap/web test:e2e screenshots` with `prefers-reduced-motion: reduce` so every reveal is in its final pose.
Tokens, motion durations and contrast rules are unchanged from [m3-demo.md](m3-demo.md).

## Decisions

| Decision                                                                                                                                                                          | Why                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Offline workspace on demo data:** `/analyses/demo-<sample>` (`archmap`, `circular`, `monorepo`, `type-cycle`) renders the bundled JSON through the same routes.                 | Insights, Files and Report work with no API, so the whole product is testable and demoable offline. `/analyses/demo-synthetic-<100,500,1000,5000>` are deterministic generated stress graphs, labelled "Synthetic benchmark graph", never presented as analyzer output. |
| `/demo` is the same `Workspace` component plus a sample picker, walkthrough and provenance banner. "Open the full workspace" links to `/analyses/demo-<id>`.                      | One implementation to test; the demo cannot drift from the product.                                                                                                                                                                                                     |
| One data provider per analysis (`/analyses/[id]/layout.tsx`) shared by Graph, Insights, Files and Report.                                                                         | Switching tabs never refetches or re-polls: "persistent navigation within the current analysis".                                                                                                                                                                        |
| Browser talks only to its own origin; `next.config.ts` rewrites `/v1/*` and `/health/*` to `ARCHMAP_API_URL` (default `http://localhost:4000`).                                   | SameSite=Strict management cookie and the API's Origin check require same-origin. Rewrites are baked in at build time for `next start`.                                                                                                                                 |
| Management cookie is HttpOnly. The UI only remembers the create response's `canManage` in `sessionStorage` (per analysis id) to decide whether to show Cancel and Delete.         | The server enforces authorization; a 401 clears the flag and shows a message.                                                                                                                                                                                           |
| No progress percentage anywhere. In-progress analyses show the current phase (queued, fetching, analyzing, saving) and elapsed time since creation.                               | Spec 7.4: do not fabricate progress.                                                                                                                                                                                                                                    |
| Large-graph aggregation: above 400 file nodes the canvas draws the frontier of a folder (or package) tree; a group is one node; clicking or pressing Enter expands it.            | ELK layout of thousands of nodes is neither fast nor readable. Edges between groups are the sum of member edges, so it is lossless by expansion (tested).                                                                                                               |
| SVG export is generated from layout data, with a sanitizer that refuses to return output containing script, foreignObject, style, event attributes, hrefs, data: URLs or DOCTYPE. | Spec 14.1 "SVG injection". Unit-tested with hostile names.                                                                                                                                                                                                              |
| CSP allows `'unsafe-inline'` scripts.                                                                                                                                             | Next.js emits inline bootstrap scripts; a nonce policy would force every page to render dynamically. Everything else is same-origin only.                                                                                                                               |

## Motion contract (additions to M3)

All motion is opacity or transform, removed under `prefers-reduced-motion: reduce`, and never required to see content.

| Element                             | Trigger                            | From to                            | Duration, easing          | Cancellation / failure                                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------- | ---------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing hero text                   | page load                          | opacity 0, y +6px to rest          | 240 ms, `ease-out-soft`   | CSS `from` keyframe only: content is visible if animation never runs                                                                                                                                                      |
| Hero graph nodes                    | page load                          | opacity 0 to 1, staggered 28 ms    | 480 ms                    | same                                                                                                                                                                                                                      |
| Section reveal (`Reveal`, `motion`) | scrolls into view, below fold only | opacity 0 and y +14px to rest      | 450 ms, `[0.2,0.7,0.2,1]` | Server HTML is visible. Hidden pose is set only after hydration, only for below-fold elements, never under reduced motion; an 8 s failsafe reveals anyway; verified by an E2E scroll test that finds no invisible element |
| Graph node and edge highlight       | selection                          | opacity or fill change             | 150 ms, 180 ms            | retargets in place                                                                                                                                                                                                        |
| Dialog, toast, menu                 | open                               | opacity 0, y +4px, scale .985 to 1 | 180 ms                    | closes immediately                                                                                                                                                                                                        |
| Explorer chevron, FAQ plus          | toggle                             | rotate 90 deg, 45 deg              | 150 ms, 200 ms            | none                                                                                                                                                                                                                      |
| Skeleton shimmer                    | loading                            | background-position                | 1.6 s linear loop         | removed under reduced motion                                                                                                                                                                                              |
| Layout after expanding a group      | expand                             | positions swap (no animation)      | n/a                       | "Updating layout" chip while ELK runs in the worker; previous drawing stays until the new one is ready                                                                                                                    |

## Global checks

- **Widths:** `e2e/responsive.spec.ts` loads every route at 360, 390, 430, 768, 1024, 1440 and 1920 px and fails on page-level horizontal overflow (scrollable regions such as tables, code and the graph canvas are exempt by design).
- **axe:** `e2e/a11y.spec.ts` runs axe (WCAG 2.0/2.1/2.2 A and AA rule sets) on every route and on key states (selection, list view, walkthrough, dialogs, import errors, every analysis state) and fails on any serious or critical violation.
- **Manual screen-reader pass: not done.** Keyboard flows are automated (tree, list, graph nodes, dialogs, shortcuts). No VoiceOver, NVDA or JAWS session was run; that remains an open item before release (spec 17.5).
- **Visual regression:** screenshots are captured and committed as evidence; there is no pixel-diff baseline yet.

## Routes

### `/` Landing

- **Purpose:** the 15 sections of spec 9.2: navigation, hero, interactive graph preview, problem, how it works, features, code-to-graph, exploration, cycles and insights, CLI, privacy and trust, real product demo, FAQ, final CTA, footer.
- **Data:** the previews are laid out with ELK on the server at build time from the committed demo JSON (`lib/landing/data.ts`), so the SVG exists in the HTML without JavaScript. No numbers on the page are invented; counts come from that data or from `DEFAULT_LIMITS`.
- **States:** loading none (static); JS off (graph, copy and FAQ visible); reduced motion; mobile shows the package-level preview instead of the file-level one.
- **Components:** `GraphPreview` (SVG, same `computeHighlight` as the workspace), `HeroPreview`, `StoryShowcase`, `ExploreShowcase`, `CycleShowcase`, `ProductDemo` (real `ExplorerTree` and `Inspector`), `Reveal`, illustrations (original SVG).
- **Interaction checklist:** CTA to demo; select nodes by click, Enter or Space; caption announces selection; direction toggle; choose statement to highlight its edge; tree selects in the inspector; FAQ details expand with keyboard.
- **A11y notes:** every graph node is a focusable button whose name contains all visible text; previews are scrollable regions with a label and `tabindex=0`; decorative illustrations are `aria-hidden`.
- **Screenshots:** `home-desktop.png`, `home-mobile.png`.

### `/demo` Demo

- **Purpose:** guided exploration of real analyzer output with sample selection, walkthrough, search, filters, cycle investigation, impact, reset and import CTA. Data is identified as demonstration data with its generating command.
- **States:** loading sample, load error with retry and default-sample fallback, empty graph, graph layout failure with list fallback.
- **Components:** `Workspace` (see below) with `demo` props, `Tour`, sample `<select>`.
- **Interaction checklist:** select (graph, tree, list, search); evidence with file:line:column; cycle via walkthrough; direction filter; reset; list keyboard; panel collapse; full screen; shortcuts `/`, `F`, `?`, `Esc`.
- **Screenshots:** `demo-*`, `state-demo-selection-*`, `state-demo-walkthrough-*`, `state-list-view-*`.

### `/import` Import

- **Purpose:** start a hosted analysis. Input validated by `parseRepositoryInput` and `CreateAnalysisRequest` (the same code the API uses), optional ref, supported-repository guidance, privacy statement, limits from `DEFAULT_LIMITS`, CLI link.
- **States:** idle; field errors (empty, foreign host, bad ref) with `aria-invalid` and focus; submitting (button busy, one request); service unreachable or degraded advisory (from `/health/ready`); every `ErrorCode` with a human message and one recovery action (rate limited, imports disabled, queue full, not found, not public, ref not found, GitHub unavailable, over limits, timeout, internal, network).
- **Components:** `ImportForm`, `Callout`, limits table.
- **Interaction checklist:** Enter submits; errors clear on typing; prefill via `?repo=` and `?ref=`; success stores `canManage` and redirects to `/analyses/<id>`.
- **Screenshots:** `import-*`, `state-import-error-*`, `state-import-rate-limited-*`.

### `/analyses/[id]` Workspace

- **Purpose:** the main product interface (spec 9.5). Hosted ids poll `GET /v1/analyses/:id` while non-terminal, then load `GET .../graph` and validate it with `ArchmapGraph`.
- **Header:** repository, status, commit (short, full copy), analyzer and schema versions, timestamps, expiry, Share (copies the plain URL), Export (to Report), Help; Cancel and Delete only when `canManage`.
- **States:** loading; in progress (phase list, no percentage, reconnect note); failed (reason and recovery); cancelled; expired (410 or status); not found (404); not ready (409, keeps polling); stalled network (retry); invalid graph; ready.
- **Left panel:** search (combobox with results), tabs Explorer (keyboard tree, folder or package grouping, expand and collapse, cycle markers), View (direction, filters, grouping, layout, legend), Cycles (cycles and unresolved imports). Resizable by pointer and by keyboard.
- **Canvas:** pan, zoom, fit, reset, selection, highlighting, direction filters, grouping, layout direction, legend, search highlighting, large-graph aggregation, sanitized SVG export.
- **Inspector:** path, language, package, imports, importers with evidence, findings, potential impact, copy path, copy node id, copy source location, open in Files, collapse group.
- **Utilities:** panel collapse, full screen, graph/list switch, deep links `?node=` and `?cycle=`.
- **Screenshots:** `analysis-graph-*`, `analysis-graph-cycle-*`, `analysis-graph-large-*`, `state-analysis-in-progress-*`, `state-analysis-failed-*`, `state-analysis-cancelled-*`, `state-analysis-expired-*`, `state-analysis-not-found-*`.
- **A11y notes:** nodes are focusable groups whose names carry kind, package and relationship; highlight is never colour-only (text tag and solid or dashed edges); inspector is a dialog below 1024 px; one polite live region announces selection, expansion, reset and full screen; all `/analyses/*` pages are `noindex` (meta and `X-Robots-Tag`).

### `/analyses/[id]/insights`

- **Purpose:** metrics, cycles with evidence, coupling and hotspots, package relationships (`aggregateByPackage`), unresolved imports, diagnostics, evidence per finding, methodology and limitations with the documented rules (ADR-0004).
- **States:** every section has an empty state with a sentence, not a blank.
- **Screenshots:** `analysis-insights-*`.

### `/analyses/[id]/files`

- **Purpose:** searchable file tree, per-file metadata, imports, re-exports, importers and unresolved imports as edges with evidence, and a link to the graph node (`?node=`). It states plainly that symbols and named exports are not extracted.
- **Screenshots:** `analysis-files-*`.

### `/analyses/[id]/report`

- **Purpose:** identity, commit, versions, scope, summary, findings, cycles, diagnostics, limitations; exports: JSON (graph), Markdown (server report, or computed in the browser when offline or on demo data, with the source stated), sanitized SVG of the overview layout. Print stylesheet hides chrome.
- **Screenshots:** `analysis-report-*`.

### `/docs`, `/docs/getting-started`, `/docs/cli`, `/docs/architecture`, `/docs/analysis-coverage`, `/docs/troubleshooting`

- **Purpose:** content derived from README, `docs/architecture/*`, `docs/adr/*`, the CLI source and `@archmap/contracts` (options, exit codes, schema reference, algorithms, hosted API, every error code with recovery). Tables that mirror code (error codes, job states, limits) are generated from the contract so they cannot drift.
- **Components:** `Doc`, `Table`, `CodeBlock` (copy button), `DocsNav` (sidebar, collapses to a disclosure on small screens), breadcrumbs, pager.
- **Screenshots:** `docs-*`.

### `/privacy`, `/security`

- **Purpose:** from the threat model and spec 8.4 and 14: local CLI never uploads; hosted accepts public GitHub repositories only; results shareable by URL; 24 h retention (from `DEFAULT_LIMITS`); deletable by the creator; no AI transfer; no repository code execution. The security page separates enforced analyzer controls from hosted controls the design requires, and lists known limits.
- **Screenshots:** `privacy-*`, `security-*`.

### Not found, error boundaries

- `not-found.tsx` (links home, demo, docs), `error.tsx` (route boundary with retry), `global-error.tsx` (root failure with its own html and body). Screenshots: `not-found-*`.
