import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Breadcrumbs } from "../ui/primitives";
import { DOC_LINKS } from "./links";

/** Page chrome shared by every docs page and the policy pages: breadcrumb, h1, lead, prose body, prev/next. */
export function Doc({
  path,
  title,
  lead,
  children,
  crumbs,
  pager = true,
}: {
  path?: string;
  title: string;
  lead: React.ReactNode;
  children: React.ReactNode;
  crumbs?: { href?: string; label: string }[];
  pager?: boolean;
}) {
  const i = DOC_LINKS.findIndex((l) => l.href === path);
  const prev = i > 0 ? DOC_LINKS[i - 1] : null;
  const next = i >= 0 && i < DOC_LINKS.length - 1 ? DOC_LINKS[i + 1] : null;
  return (
    <>
      <Breadcrumbs
        items={
          crumbs ?? [
            { href: "/", label: "Home" },
            { href: "/docs", label: "Docs" },
            { label: title },
          ]
        }
      />
      <h1 className="mt-4 font-display text-[clamp(1.9rem,4vw,2.6rem)] font-semibold leading-tight tracking-tight">
        {title}
      </h1>
      <p className="mt-3 max-w-[62ch] text-[18px] leading-relaxed text-muted">{lead}</p>
      <div className="am-prose mt-8">{children}</div>
      {pager && i >= 0 && (
        <nav
          aria-label="Pager"
          className="mt-16 flex flex-wrap justify-between gap-3 border-t border-line pt-6"
        >
          {prev ? (
            <Link href={prev.href} className="am-btn">
              <ArrowLeft size={16} aria-hidden="true" /> {prev.label}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={next.href} className="am-btn">
              {next.label} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

export function Table({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="am-table-wrap not-prose">
      <table className="am-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {c}
                  </th>
                ) : (
                  <td key={j}>{c}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
