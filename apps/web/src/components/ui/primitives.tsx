import Link from "next/link";
import { AlertTriangle, ChevronRight, Info, Loader2 } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <Loader2
      size={18}
      aria-hidden="true"
      className={`animate-spin motion-reduce:animate-none ${className}`}
    />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`am-skeleton rounded-md bg-elevated ${className}`} />;
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";
const TONE: Record<Tone, string> = {
  neutral: "bg-elevated text-ink border-line",
  info: "bg-primary-soft text-ink border-primary-strong/40",
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  accent: "bg-accent-soft text-accent-strong border-accent-strong/30",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-[12px] font-medium leading-5 ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {items.map((it, i) => (
          <li key={`${it.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
            {it.href && i < items.length - 1 ? (
              <Link
                href={it.href}
                className="inline-flex min-h-6 items-center rounded underline-offset-2 hover:text-ink hover:underline"
              >
                {it.label}
              </Link>
            ) : (
              <span
                aria-current={i === items.length - 1 ? "page" : undefined}
                className="font-medium text-ink"
              >
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger";
  title?: string;
  children: React.ReactNode;
}) {
  const Icon = tone === "info" ? Info : AlertTriangle;
  const cls =
    tone === "info"
      ? "border-primary-strong/30 bg-primary-soft"
      : tone === "warning"
        ? "border-warning/40 bg-warning-soft"
        : "border-danger/40 bg-danger-soft";
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-[14px] leading-relaxed ${cls}`}>
      <Icon size={18} aria-hidden="true" className="mt-0.5 flex-none" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
}

/** A full-width status block for empty, error and info states. */
export function StateCard({
  icon,
  title,
  children,
  actions,
  tone = "neutral",
  role,
  headingLevel = 2,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "neutral" | "danger" | "warning";
  role?: "alert" | "status";
  headingLevel?: 1 | 2 | 3;
}) {
  const H = `h${headingLevel}` as "h1" | "h2" | "h3";
  const border =
    tone === "danger"
      ? "border-danger/40"
      : tone === "warning"
        ? "border-warning/40"
        : "border-line";
  return (
    <div
      role={role}
      className={`mx-auto w-full max-w-xl rounded-2xl border ${border} bg-bg p-6 sm:p-8`}
    >
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <H className="font-display text-xl font-semibold leading-snug tracking-tight">{title}</H>
      {children && <div className="mt-2 text-[15px] leading-relaxed text-muted">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-control bg-surface px-1.5 py-0.5 font-mono text-[12px]">
      {children}
    </kbd>
  );
}
