import Link from "next/link";
import { SiteNav } from "./site-nav";

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 7.5 17 6M6 7.5 9 17.5M9 17.5 17 6" stroke="#7a88a1" strokeWidth="1.5" />
      <circle cx="6" cy="7.5" r="3" fill="#476cf0" />
      <circle cx="17" cy="6" r="2.5" fill="#8d85f6" />
      <circle cx="9" cy="17.5" r="2.5" fill="#151b2b" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-line bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-md" aria-label="ARCHMAP home">
          <LogoMark />
          <span className="font-display text-[15px] font-semibold tracking-[0.08em]">ARCHMAP</span>
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
