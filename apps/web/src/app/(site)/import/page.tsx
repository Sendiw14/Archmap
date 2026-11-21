import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Clock, FileWarning, Lock, ShieldCheck, Terminal } from "lucide-react";
import { DEFAULT_LIMITS } from "@archmap/contracts";
import { ImportForm } from "../../../components/import/import-form";
import { Breadcrumbs, Skeleton } from "../../../components/ui/primitives";
import { formatCount, formatDuration, formatHours, formatMiB } from "../../../lib/format";

export const metadata: Metadata = {
  title: "Import a repository",
  description:
    "Analyze a public GitHub repository with ARCHMAP. Results are shareable by URL and deleted after a day.",
};

const L = DEFAULT_LIMITS;

const LIMITS: [string, string][] = [
  ["Compressed download", formatMiB(L.maxArchiveBytes)],
  ["Extracted source", formatMiB(L.maxExtractedBytes)],
  ["Source files", formatCount(L.maxFiles)],
  ["Largest single file", formatMiB(L.maxFileBytes)],
  ["Analysis time", formatDuration(L.analysisTimeoutMs)],
  ["Analyses per hour, per network", formatCount(L.submissionsPerClientPerHour)],
  ["Result retention", formatHours(L.retentionHours)],
];

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Import" }]} />
      <header className="mt-5 max-w-3xl">
        <h1 className="font-display text-[clamp(1.9rem,4vw,2.75rem)] font-semibold leading-tight tracking-tight">
          Analyze a public GitHub repository
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">
          Paste a repository and ARCHMAP downloads one commit, analyzes the JavaScript and
          TypeScript in it without running any of it, and gives you an interactive dependency graph
          you can share by link.
        </p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
            <ImportForm />
          </Suspense>
          <p className="mt-4 flex items-start gap-2 text-[14px] text-muted">
            <Terminal size={16} aria-hidden="true" className="mt-1 flex-none" />
            <span>
              Private code, or no limits? Run ARCHMAP on your own machine: it never uploads
              anything. See the{" "}
              <Link
                href="/docs/cli"
                className="font-medium text-primary-strong underline underline-offset-2"
              >
                CLI instructions
              </Link>
              .
            </span>
          </p>
        </div>

        <aside aria-label="About hosted analysis" className="space-y-6">
          <section aria-labelledby="supported-h" className="am-card p-5">
            <h2
              id="supported-h"
              className="flex items-center gap-2 font-display text-base font-semibold"
            >
              <FileWarning size={18} aria-hidden="true" className="text-primary-strong" /> What can
              be analyzed
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed">
              <li>
                Public repositories on github.com. Other Git hosts and private repositories are
                rejected.
              </li>
              <li>
                JavaScript and TypeScript sources (
                <code>.ts .tsx .mts .cts .js .jsx .mjs .cjs</code>) and JSON imports. Vue, Svelte,
                Astro and CSS imports are not followed.
              </li>
              <li>
                Static <code>import</code>, <code>export … from</code>, <code>require</code> and
                literal <code>import()</code>. Computed specifiers are reported as unsupported.
              </li>
              <li>
                One commit per analysis, resolved from the branch, tag or SHA you give. See{" "}
                <Link
                  href="/docs/analysis-coverage"
                  className="text-primary-strong underline underline-offset-2"
                >
                  analysis coverage
                </Link>
                .
              </li>
            </ul>
          </section>

          <section aria-labelledby="privacy-h" className="am-card p-5">
            <h2
              id="privacy-h"
              className="flex items-center gap-2 font-display text-base font-semibold"
            >
              <Lock size={18} aria-hidden="true" className="text-primary-strong" /> Privacy
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed">
              <li>
                Results are shareable: anyone with the link can view them, so do not analyze a
                public repository that contains material you would not want linked.
              </li>
              <li>
                Results are deleted after {formatHours(L.retentionHours)}. You can delete one sooner
                from the browser that created it.
              </li>
              <li>
                No source code is sent to any AI service, and no repository code is ever executed.
              </li>
            </ul>
            <p className="mt-3 text-[14px]">
              <Link
                href="/privacy"
                className="font-medium text-primary-strong underline underline-offset-2"
              >
                Read the privacy statement
              </Link>
              .
            </p>
          </section>

          <section aria-labelledby="limits-h" className="am-card p-5">
            <h2
              id="limits-h"
              className="flex items-center gap-2 font-display text-base font-semibold"
            >
              <Clock size={18} aria-hidden="true" className="text-primary-strong" /> Limits
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Starting policy, not a measured capacity guarantee.
            </p>
            <dl className="mt-3 divide-y divide-line text-[14px]">
              {LIMITS.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-1.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="flex items-start gap-2 text-[13px] text-muted">
            <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 flex-none" />
            Read how this is kept safe on the{" "}
            <Link href="/security" className="text-primary-strong underline underline-offset-2">
              security page
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
