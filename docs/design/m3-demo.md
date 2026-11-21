# M3 demo UI: tokens, motion contract, accessibility notes

Scope: `apps/web` routes `/` (hero stub), `/demo`, `/docs/cli`. Spec refs: 9.3, 10, 11, 12.

## Tokens

Defined once in `apps/web/src/app/globals.css` (`@theme`), exposed as CSS variables and Tailwind utilities.
Contrast is asserted by `apps/web/src/styles/contrast.test.ts`, which parses the stylesheet.

| Token                      | Value                       | Use                                                                          |
| -------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| bg / surface / elevated    | #FFFFFF / #F7F9FC / #F1F5FB | page, canvas and panels, raised blocks                                       |
| ink / muted / line         | #151B2B / #526079 / #E2E8F0 | text, secondary text, hairlines                                              |
| primary                    | #476CF0                     | graphics only (outgoing edges, node accents): 4.50 on white, 4.26 on surface |
| primary-strong             | #3452D1                     | text links, filled buttons (white text 6.41:1), focus ring                   |
| accent / accent-strong     | #8D85F6 / #5A50D9           | accent is a fill only (3.08:1); strong for incoming edges and text           |
| control                    | #6B7A92                     | input and button borders (>= 3:1 on every surface)                           |
| danger / warning / success | #B42318 / #8A4B08 / #0B6B46 | semantic text, each with a `-soft` tint at >= 4.5:1                          |
| cycle                      | #B54708                     | cycle members and evidence edges                                             |

`#476CF0` is below 4.5:1 on `surface`, so it is never used for text; this is why `primary-strong` exists.

## Motion contract

All motion is transform/opacity, 120 to 250 ms, and removed under `prefers-reduced-motion: reduce`
(global override in `globals.css`; the `fitView` duration used for search/cycle focus is also set to 0).

| Element            | Trigger              | From -> to                           | Duration / easing     | Cancellation                                       |
| ------------------ | -------------------- | ------------------------------------ | --------------------- | -------------------------------------------------- |
| Hero text, card    | page load            | opacity 0, y +6px -> rest            | 240 ms, ease-out-soft | CSS only; visible by default if animations are off |
| Walkthrough card   | open                 | same as hero                         | 240 ms                | none needed                                        |
| Inspector drawer   | open (< 1024px)      | opacity 0, y +16px -> rest           | 220 ms                | closes immediately on Escape or backdrop           |
| Node dim/highlight | selection            | opacity                              | 150 ms                | retargets in place                                 |
| Edge dim/highlight | selection            | opacity (colour changes are instant) | 180 ms                | retargets in place                                 |
| Viewport focus     | search, cycle choice | pan/zoom                             | 250 ms (0 if reduced) | superseded by the next request                     |

Graph re-layout swaps positions without animating (no layout-property transitions).

## Accessibility decisions

- The graph is never the only view: List is a native table with a button per row (Tab, ArrowUp/Down, Home/End, Enter).
- Graph nodes are focusable (`role=group`; the accessible name includes kind, package, in/out counts and the relationship to the selection). Enter or Space selects.
- Highlight state is never colour-only: nodes carry a text tag (imported, imports, mutual, cycle, match) and edge classes use solid vs dashed.
- The inspector is docked at >= 1024px and a modal dialog below it (focus moves in, Tab is trapped, Escape closes, focus returns to the opener).
- Status changes (selection, copy, reset) are announced through one polite live region.
- Nothing requires hover; nodes cannot be dragged; touch targets are >= 36px (graph controls), 40px (buttons, fields) or 32px (compact inline buttons; above the WCAG 2.2 24px minimum).
