import Link from "next/link";
import { LogoMark } from "./site-header";
import { DEFAULT_LIMITS } from "@archmap/contracts";
import { formatHours } from "../lib/format";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/demo", label: "Live demo" },
      { href: "/import", label: "Import a repository" },
      { href: "/docs/cli", label: "Command-line tool" },
    ],
  },
  {
    title: "Documentation",
    links: [
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/docs/architecture", label: "Architecture" },
      { href: "/docs/analysis-coverage", label: "Analysis coverage" },
      { href: "/docs/troubleshooting", label: "Troubleshooting" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/security", label: "Security" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md"
            aria-label="ARCHMAP home"
          >
            <LogoMark />
            <span className="font-display text-[15px] font-semibold tracking-[0.08em]">
              ARCHMAP
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-muted">
            Deterministic, evidence-backed dependency graphs for JavaScript and TypeScript.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="am-eyebrow">{c.title}</h2>
            <ul className="mt-3 space-y-1">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-8 items-center text-[14px] text-ink underline-offset-2 hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-[13px] text-muted sm:px-6">
          MIT licensed source (license text pending maintainer confirmation). Hosted results are
          shareable by URL and deleted after {formatHours(DEFAULT_LIMITS.retentionHours)}.
        </p>
      </div>
    </footer>
  );
}
