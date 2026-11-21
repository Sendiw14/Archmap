"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "/demo", label: "Demo" },
  { href: "/import", label: "Import" },
  { href: "/docs", label: "Docs" },
  { href: "/privacy", label: "Privacy" },
  { href: "/security", label: "Security" },
];

const linkClass = (current: boolean) =>
  `inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium ${
    current ? "bg-primary-soft text-ink" : "text-muted hover:bg-elevated hover:text-ink"
  }`;

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // close on navigation, Escape and outside click; keep focus on the button after Escape
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isCurrent(l.href) ? "page" : undefined}
            className={linkClass(isCurrent(l.href))}
          >
            {l.label}
          </Link>
        ))}
        <Link href="/import" className="am-btn am-btn-primary ml-2 min-h-10">
          Analyze a repo
        </Link>
      </nav>
      <div className="md:hidden">
        <button
          ref={button}
          type="button"
          className="am-btn size-10 !px-0"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        {open && (
          <div
            ref={menu}
            id="mobile-menu"
            className="am-pop absolute inset-x-0 top-14 border-b border-line bg-bg px-4 pb-4 pt-2 shadow-[0_12px_32px_rgba(21,27,43,0.12)]"
          >
            <nav aria-label="Primary mobile" className="flex flex-col">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isCurrent(l.href) ? "page" : undefined}
                  className={`${linkClass(isCurrent(l.href))} min-h-12 text-base`}
                >
                  {l.label}
                </Link>
              ))}
              <Link href="/import" className="am-btn am-btn-primary mt-2 min-h-12 text-base">
                Analyze a repo
              </Link>
            </nav>
          </div>
        )}
      </div>
    </>
  );
}
