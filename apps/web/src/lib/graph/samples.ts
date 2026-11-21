/**
 * Demonstration samples. Every file under src/demo-data is real analyzer output
 * produced by `pnpm demo:data` (never hand-edited). Loaders are lazy so each sample
 * is its own chunk and the UI has genuine loading/error states.
 */
export interface DemoSample {
  id: string;
  label: string;
  description: string;
  /** What was analyzed. */
  source: string;
  /** Exact CLI invocation that produced the file (see the demo:data script). */
  command: string;
  load: () => Promise<unknown>;
}

export const SAMPLES: DemoSample[] = [
  {
    id: "archmap",
    label: "ARCHMAP (this repository)",
    description: "ARCHMAP analyzing its own source.",
    source: "Repository root, excluding fixtures and apps/web",
    command: "archmap analyze . -e 'fixtures/**' -e fixtures -e 'apps/web/**' --reproducible -q",
    load: () => import("../../demo-data/archmap.json").then((m) => m.default),
  },
  {
    id: "circular",
    label: "Circular imports",
    description: "Four files, three of them importing each other in a ring.",
    source: "fixtures/circular",
    command: "archmap analyze fixtures/circular --reproducible -q",
    load: () => import("../../demo-data/circular.json").then((m) => m.default),
  },
  {
    id: "monorepo",
    label: "Small monorepo",
    description: "Two workspace packages and one external dependency.",
    source: "fixtures/monorepo",
    command: "archmap analyze fixtures/monorepo --reproducible -q",
    load: () => import("../../demo-data/monorepo.json").then((m) => m.default),
  },
  {
    id: "type-cycle",
    label: "Type-only cycle",
    description: "Two files that only form a cycle through type-only imports.",
    source: "fixtures/type-cycle",
    command: "archmap analyze fixtures/type-cycle --reproducible -q",
    load: () => import("../../demo-data/type-cycle.json").then((m) => m.default),
  },
];

export const DEFAULT_SAMPLE_ID = "archmap";
