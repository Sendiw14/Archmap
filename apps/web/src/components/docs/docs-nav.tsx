"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_LINKS } from "./links";

export function DocsNav() {
  const pathname = usePathname();
  const links = (
    <ul className="space-y-0.5">
      {DOC_LINKS.map((l) => {
        const current = pathname === l.href;
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-10 items-center rounded-lg px-3 text-[14px] ${
                current
                  ? "bg-primary-soft font-semibold text-ink"
                  : "text-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
  return (
    <>
      <nav aria-label="Documentation" className="hidden lg:block">
        {links}
      </nav>
      <details className="rounded-xl border border-line bg-surface px-3 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center text-[14px] font-medium">
          Documentation menu
        </summary>
        <nav aria-label="Documentation" className="pb-2">
          {links}
        </nav>
      </details>
    </>
  );
}
