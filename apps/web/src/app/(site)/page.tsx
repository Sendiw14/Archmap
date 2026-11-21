import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GitBranch, Terminal } from "lucide-react";
import { DEFAULT_LIMITS } from "@archmap/contracts";
import { getLandingData } from "../../lib/landing/data";
import { formatCount, formatHours } from "../../lib/format";
import {
  CycleShowcase,
  ExploreShowcase,
  HeroPreview,
  ProductDemo,
  StoryShowcase,
} from "../../components/marketing/landing-interactive";
import { Reveal } from "../../components/marketing/reveal";
import { CodeBlock } from "../../components/docs/code-block";
import {
  CycleArt,
  EvidenceArt,
  ExportArt,
  ExtractArt,
  GraphArt,
  GroupArt,
  ImpactArt,
  ListArt,
  LockArt,
  ResolveArt,
  ScanArt,
} from "../../components/marketing/illustrations";

export const metadata: Metadata = {
  title: { absolute: "ARCHMAP: See the architecture behind your code" },
  description:
    "ARCHMAP analyzes JavaScript and TypeScript repositories and draws how modules depend on each other. Every edge points back to the import statement behind it.",
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="am-eyebrow">{children}</p>
);

function SectionHead({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="max-w-3xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className="mt-3 font-display text-[clamp(1.7rem,3.6vw,2.5rem)] font-semibold leading-[1.12] tracking-tight"
      >
        {title}
      </h2>
      {children && (
        <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-muted">{children}</p>
      )}
    </header>
  );
}

const Section = ({
  id,
  children,
  tone = "bg",
}: {
  id: string;
  children: React.ReactNode;
  tone?: "bg" | "surface";
}) => (
  <section
    aria-labelledby={id}
    className={tone === "surface" ? "border-y border-line bg-surface" : ""}
  >
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">{children}</div>
  </section>
);

const STEPS = [
  {
    art: <ScanArt />,
    title: "Scan",
    body: "A root-confined walk lists your source files under size and count budgets. Symlinks are skipped; nothing outside the repository is read.",
  },
  {
    art: <ExtractArt />,
    title: "Extract",
    body: "Each file is parsed as syntax, never type-checked and never run. Every import, export-from, require and literal dynamic import is recorded with its position.",
  },
  {
    art: <ResolveArt />,
    title: "Resolve",
    body: "Specifiers are resolved by TypeScript's own module resolution: tsconfig paths, package exports, workspace packages, project references.",
  },
  {
    art: <GraphArt />,
    title: "Graph and findings",
    body: "One edge per statement, sorted and hashed so output is deterministic. Cycles, hotspots and unresolved imports are derived with versioned rules.",
  },
];

const FEATURES = [
  {
    art: <EvidenceArt />,
    title: "Evidence on every edge",
    body: "Click any dependency and see the file, line, column and the statement that created it. No claim without a source line.",
  },
  {
    art: <CycleArt />,
    title: "Cycles, separated by kind",
    body: "Runtime cycles are warnings. Cycles that exist only through type-only imports are reported separately, because they are erased at runtime.",
  },
  {
    art: <ImpactArt />,
    title: "Potential change impact",
    body: "See every module that imports a file, directly or through others, with the shortest chain. Worded as reachability, never as a prediction.",
  },
  {
    art: <GroupArt />,
    title: "Built for large repositories",
    body: "Above 400 files the graph starts grouped by folder or package. Click a group to expand it; edges between groups are the sum of their members.",
  },
  {
    art: <ListArt />,
    title: "A graph is never the only view",
    body: "Every module and relationship is also in a keyboard-operable table and tree, so nothing depends on seeing or dragging a canvas.",
  },
  {
    art: <ExportArt />,
    title: "Reports you can keep",
    body: "Download the full graph as JSON, a Markdown report, or a sanitized SVG of the current view. The report is derived only from the graph.",
  },
];

const FAQ = [
  {
    q: "Does ARCHMAP run my code?",
    a: "No. Files are parsed as syntax only. Repository scripts, install hooks, configuration files and plugins are never executed, and the analyzer never reads outside the repository root or follows symbolic links.",
  },
  {
    q: "Does my source code leave my machine?",
    a: "Not with the CLI: it works offline, needs no account and sends nothing. Hosted import is a separate, optional path that accepts public GitHub repositories only.",
  },
  {
    q: "Who can see a hosted analysis?",
    a: `Anyone with its link, because results are shareable by URL. They are deleted after ${formatHours(DEFAULT_LIMITS.retentionHours)}, and the browser that created one can delete it sooner. They are marked noindex and are never sent to an AI service.`,
  },
  {
    q: "What does it understand, and what does it miss?",
    a: "Static import, export-from, require and literal dynamic import in JavaScript and TypeScript, resolved with TypeScript's rules. It does not follow computed imports, Vue or Svelte single-file components, CSS imports or framework conventions, and it works at file level, not symbol level. The coverage page lists everything.",
  },
  {
    q: "Is 'potential change impact' a prediction?",
    a: "No. It is static reachability: the modules that import a file, directly or through others. It tells you where a change could reach, not that anything will break.",
  },
  {
    q: "Is the output reproducible?",
    a: "Yes. Nodes, edges and findings are sorted and their ids derive from content. With --reproducible the timestamp is omitted and repeated runs are byte-identical.",
  },
];

export default async function Landing() {
  const data = await getLandingData();
  return (
    <>
      {/* 2 + 3. Hero with the interactive graph preview */}
      <section aria-labelledby="hero-h" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_26rem_at_80%_-6rem,var(--color-primary-soft),transparent_70%)]"
        />
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pb-16 sm:pt-14">
          <p className="am-eyebrow am-enter">Dependency graphs, with evidence</p>
          <h1
            id="hero-h"
            className="am-enter-2 mt-4 max-w-4xl font-display text-[clamp(2.3rem,5.6vw,3.9rem)] font-semibold leading-[1.05] tracking-[-0.02em]"
          >
            See the architecture behind your code.
          </h1>
          <p className="am-enter-3 mt-5 max-w-[40rem] text-[clamp(1.05rem,1.6vw,1.2rem)] leading-relaxed text-muted">
            ARCHMAP reads your JavaScript and TypeScript, resolves every import the way TypeScript
            does, and draws how modules depend on each other. Every edge points back to the line
            that created it.
          </p>
          <div className="am-enter-3 mt-6 flex flex-wrap items-center gap-3">
            <Link href="/demo" className="am-btn am-btn-primary min-h-12 px-5 text-[15px]">
              Explore the live demo <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/import" className="am-btn min-h-12 px-5 text-[15px]">
              <GitBranch size={18} aria-hidden="true" /> Analyze a public repo
            </Link>
            <Link href="/docs/cli" className="am-btn am-btn-quiet min-h-12 px-4 text-[15px]">
              <Terminal size={18} aria-hidden="true" /> Run it locally
            </Link>
          </div>
          <p className="am-enter-3 mt-4 text-sm text-muted">
            No account. The demo runs on real analyzer output, nothing mocked.
          </p>
          <div className="am-fade mt-8 sm:mt-10">
            <HeroPreview data={data} />
          </div>
        </div>
      </section>

      {/* 4. Problem */}
      <Section id="problem-h">
        <Reveal>
          <SectionHead
            id="problem-h"
            eyebrow="The problem"
            title="The architecture of a codebase is written in its imports, and nobody draws it."
          >
            Diagrams are drawn once and drift. Folders suggest a structure the imports quietly
            contradict. So three questions stay hard to answer from the code alone.
          </SectionHead>
        </Reveal>
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            [
              "What depends on this?",
              "Before changing a module you want the list of everything that imports it, directly and through others, not a guess from grep.",
            ],
            [
              "Where are the loops?",
              "Circular imports cause initialization bugs and block extraction. They are invisible until something fails, and easy to confuse with harmless type-only cycles.",
            ],
            [
              "Which parts are tangled?",
              "A handful of files carry most of the coupling. Seeing them, with the evidence, turns a vague unease into a concrete refactor.",
            ],
          ].map(([t, b], i) => (
            <Reveal key={t} as="li" delay={i * 0.06} className="am-card p-6">
              <h3 className="font-display text-lg font-semibold leading-snug">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{b}</p>
            </Reveal>
          ))}
        </ul>
      </Section>

      {/* 5. How it works */}
      <Section id="how-h" tone="surface">
        <Reveal>
          <SectionHead
            id="how-h"
            eyebrow="How ARCHMAP works"
            title="Four deterministic steps from files to a graph."
          >
            The same pipeline runs in the CLI, in the hosted worker and in the demo data you see on
            this page.
          </SectionHead>
        </Reveal>
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal
              key={s.title}
              as="li"
              delay={i * 0.06}
              className="am-card flex flex-col bg-bg p-6"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[13px] font-semibold text-primary-strong">
                  0{i + 1}
                </span>
                <div className="w-24">{s.art}</div>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* 6. Features */}
      <Section id="features-h">
        <Reveal>
          <SectionHead
            id="features-h"
            eyebrow="What you get"
            title="A workspace for understanding, not a poster of boxes."
          />
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} as="li" delay={(i % 3) * 0.05} className="am-card p-6">
              <div className="mb-4 h-16 w-28">{f.art}</div>
              <h3 className="font-display text-lg font-semibold leading-snug">{f.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{f.body}</p>
            </Reveal>
          ))}
        </ul>
      </Section>

      {/* 7. Code to graph */}
      <Section id="story-h" tone="surface">
        <Reveal>
          <SectionHead
            id="story-h"
            eyebrow="From code to graph"
            title="One import statement becomes one edge."
          >
            These are the statements the analyzer actually recorded for a small sample with a
            circular import. Choose one to see the edge it produces.
          </SectionHead>
        </Reveal>
        <Reveal className="mt-10">
          <StoryShowcase data={data} />
        </Reveal>
      </Section>

      {/* 8. Exploration */}
      <Section id="explore-h">
        <Reveal>
          <SectionHead
            id="explore-h"
            eyebrow="Explore dependencies"
            title="Pick a module. See what it needs and what needs it."
          >
            Highlight only what a module imports, only what imports it, or both. The counts and
            evidence below come from the analysis of ARCHMAP itself.
          </SectionHead>
        </Reveal>
        <Reveal className="mt-10">
          <ExploreShowcase data={data} />
        </Reveal>
      </Section>

      {/* 9. Cycles and insights */}
      <Section id="cycles-h" tone="surface">
        <Reveal>
          <SectionHead
            id="cycles-h"
            eyebrow="Cycles and insights"
            title="Find the loops, and know which ones matter."
          >
            A cycle is a set of modules that can all reach each other through imports. ARCHMAP
            reports runtime cycles and type-only cycles separately, with the imports that close the
            loop.
          </SectionHead>
        </Reveal>
        <Reveal className="mt-10">
          <CycleShowcase data={data} />
        </Reveal>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            [
              "Coupling hotspots",
              "Files whose fan-in plus fan-out is unusually high for the repository, by a documented statistical rule.",
            ],
            [
              "Package relationships",
              "File-level edges summed into package-to-package dependencies.",
            ],
            [
              "Unresolved imports and diagnostics",
              "Everything the analyzer could not handle is listed, with its line, never silently dropped.",
            ],
          ].map(([t, b]) => (
            <li key={t} className="rounded-xl border border-line bg-bg p-5">
              <h3 className="font-display text-[15px] font-semibold">{t}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{b}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 10. CLI */}
      <Section id="cli-h">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Reveal>
            <SectionHead
              id="cli-h"
              eyebrow="Local first"
              title="Runs on your machine. Uploads nothing."
            >
              The command-line tool is the complete product. It needs no account, makes no network
              requests and works on private code.
            </SectionHead>
            <ul className="mt-6 space-y-2 text-[15px]">
              {[
                "JSON graph or Markdown report",
                "Byte-identical output with --reproducible",
                "Exit codes you can script against",
                "Needs Node.js 22.18 or newer",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 flex-none rounded-full bg-primary-strong"
                  />
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/docs/cli" className="am-btn mt-7">
              <Terminal size={16} aria-hidden="true" /> CLI reference
            </Link>
          </Reveal>
          <Reveal delay={0.08}>
            <CodeBlock label="CLI example">{`$ pnpm archmap analyze . -o graph.json --reproducible
completed: 4 files, 4 edges, 1 runtime cycle(s),
  0 unresolved, 0 diagnostic(s) -> graph.json

$ pnpm archmap analyze . -f markdown
# ARCHMAP report: repo`}</CodeBlock>
            <p className="mt-3 text-[13px] text-muted">
              The summary line is real output from the circular sample.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* 11. Privacy and trust */}
      <Section id="trust-h" tone="surface">
        <Reveal>
          <SectionHead
            id="trust-h"
            eyebrow="Privacy and trust"
            title="Clear about where your code goes. Which is nowhere."
          >
            Hosted import exists for convenience and is deliberately narrow.
          </SectionHead>
        </Reveal>
        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Local stays local", "The CLI never uploads, phones home or needs an account."],
            [
              "Public repositories only",
              "Hosted import rejects private repositories, other hosts and arbitrary URLs.",
            ],
            [
              "Short-lived, shareable",
              `Results are shareable by link, deleted after ${formatHours(DEFAULT_LIMITS.retentionHours)}, and deletable earlier by their creator.`,
            ],
            [
              "No AI, no execution",
              "Source is never sent to an AI provider, and repository code is never run.",
            ],
          ].map(([t, b], i) => (
            <Reveal key={t} as="li" delay={i * 0.05} className="am-card flex flex-col bg-bg p-6">
              <div className="mb-3 w-16">
                <LockArt />
              </div>
              <h3 className="font-display text-base font-semibold">{t}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{b}</p>
            </Reveal>
          ))}
        </ul>
        <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
          <Link
            href="/privacy"
            className="font-medium text-primary-strong underline underline-offset-2"
          >
            Read the privacy statement
          </Link>
          <Link
            href="/security"
            className="font-medium text-primary-strong underline underline-offset-2"
          >
            Read how it is secured
          </Link>
        </p>
      </Section>

      {/* 12. Real product demo */}
      <Section id="demo-h">
        <Reveal>
          <SectionHead
            id="demo-h"
            eyebrow="The product, live"
            title="This is the real workspace, on real data."
          >
            Explorer, graph and inspector, wired together exactly as in the full demo. Select a file
            in the tree or the graph.
          </SectionHead>
        </Reveal>
        <Reveal className="mt-10">
          <ProductDemo data={data} />
        </Reveal>
        <p className="mt-4 text-[13px] text-muted">
          Demonstration data: ARCHMAP analyzing itself ({formatCount(data.facts.files)} files,
          excluding fixtures and the web app), analyzer {data.facts.analyzer}.
        </p>
      </Section>

      {/* 13. FAQ */}
      <Section id="faq-h" tone="surface">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
          <Reveal>
            <SectionHead id="faq-h" eyebrow="Questions" title="Plain answers." />
          </Reveal>
          <Reveal delay={0.06}>
            <div className="divide-y divide-line rounded-2xl border border-line bg-bg">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-5">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span
                      aria-hidden="true"
                      className="flex size-6 flex-none items-center justify-center rounded-full border border-control text-[16px] leading-none transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 pr-8 text-[15px] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-4 text-[14px] text-muted">
              More in the{" "}
              <Link href="/docs" className="text-primary-strong underline underline-offset-2">
                documentation
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </Section>

      {/* 14. Final CTA */}
      <section aria-labelledby="cta-h">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal className="rounded-3xl border border-line bg-[linear-gradient(135deg,var(--color-primary-soft),var(--color-accent-soft))] px-6 py-14 text-center sm:px-12">
            <h2
              id="cta-h"
              className="mx-auto max-w-2xl font-display text-[clamp(1.8rem,4vw,2.8rem)] font-semibold leading-[1.1] tracking-tight"
            >
              Look at your own architecture.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-muted">
              Start with the demo, then point ARCHMAP at a repository of your own.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/demo" className="am-btn am-btn-primary min-h-12 px-6 text-[15px]">
                Explore the live demo <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/import" className="am-btn min-h-12 px-6 text-[15px]">
                Analyze a public repo
              </Link>
              <Link href="/docs/getting-started" className="am-btn min-h-12 px-6 text-[15px]">
                Run it locally
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
