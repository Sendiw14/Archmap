"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock,
  FileQuestion,
  Loader2,
  RefreshCcw,
  SearchX,
  Trash2,
} from "lucide-react";
import type { AnalysisSummary, ErrorCode } from "@archmap/contracts";
import { ERROR_COPY, copyForError, type ErrorCopy } from "../../lib/api/errors";
import { PHASES, PHASE_LABEL, isPhase } from "../../lib/api/poll";
import { formatDateTime, relativeTime } from "../../lib/format";
import { Skeleton, StateCard } from "../ui/primitives";
import { useAnalysis } from "./provider";

const importHref = (s: AnalysisSummary | null) =>
  s
    ? `/import?repo=${encodeURIComponent(`${s.repository.owner}/${s.repository.repo}`)}${s.ref ? `&ref=${encodeURIComponent(s.ref)}` : ""}`
    : "/import";

/** One primary recovery action per error, derived from the ErrorCopy action kind. */
export function RecoveryActions({
  copy,
  onRetry,
  href = "/import",
}: {
  copy: ErrorCopy;
  onRetry?: () => void;
  href?: string;
}) {
  const primary = "am-btn am-btn-primary";
  return (
    <>
      {copy.action === "cli" && (
        <Link href="/docs/cli" className={primary}>
          {copy.actionLabel}
        </Link>
      )}
      {copy.action === "edit" && (
        <Link href={href} className={primary}>
          {copy.actionLabel}
        </Link>
      )}
      {copy.action === "none" && (
        <Link href="/import" className={primary}>
          Import a repository
        </Link>
      )}
      {(copy.action === "retry" || copy.action === "wait") && onRetry && (
        <button type="button" className={primary} onClick={onRetry}>
          <RefreshCcw size={16} aria-hidden="true" /> {copy.actionLabel}
        </button>
      )}
      <Link href="/demo" className="am-btn">
        Explore the demo
      </Link>
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-12 sm:px-6 sm:py-16">{children}</div>;
}

export function LoadingScreen({ message }: { message: string }) {
  return (
    <Centered>
      <div role="status" aria-live="polite" className="mx-auto max-w-xl">
        <p className="flex items-center gap-2 text-[15px] text-muted">
          <Loader2
            size={18}
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
          {message}&hellip;
        </p>
        <div className="mt-6 space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </Centered>
  );
}

function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function PendingScreen({ summary, stale }: { summary: AnalysisSummary; stale: boolean }) {
  const { canManage, cancel, busy } = useAnalysis();
  useTick(15_000);
  const current = isPhase(summary.status) ? PHASES.indexOf(summary.status) : 0;
  return (
    <Centered>
      <div className="mx-auto max-w-xl">
        <p className="am-eyebrow">Analysis in progress</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          {summary.repository.owner}/{summary.repository.repo}
        </h1>
        <p className="mt-1 text-[14px] text-muted">
          Commit <code>{summary.commit.slice(0, 7)}</code>
          {summary.ref ? (
            <>
              {" "}
              on <code>{summary.ref}</code>
            </>
          ) : null}
          . Started {relativeTime(summary.createdAt)}.
        </p>

        <ol aria-label="Analysis phases" className="mt-8 space-y-0">
          {PHASES.map((p, i) => {
            const done = i < current;
            const now = i === current;
            return (
              <li key={p} aria-current={now ? "step" : undefined} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-0.5 text-muted">
                    {done ? (
                      <CheckCircle2 size={20} aria-hidden="true" className="text-success" />
                    ) : now ? (
                      <Loader2
                        size={20}
                        aria-hidden="true"
                        className="animate-spin text-primary-strong motion-reduce:animate-none"
                      />
                    ) : (
                      <Circle size={20} aria-hidden="true" />
                    )}
                  </span>
                  {i < PHASES.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`my-1 w-px flex-1 ${done ? "bg-success/50" : "bg-line"}`}
                    />
                  )}
                </div>
                <div className="pb-6">
                  <p
                    className={`font-display text-[15px] font-semibold ${now ? "text-ink" : done ? "text-ink" : "text-muted"}`}
                  >
                    {PHASE_LABEL[p].label}
                    <span className="sr-only">
                      {done ? ", done" : now ? ", in progress" : ", not started"}
                    </span>
                  </p>
                  {now && <p className="text-[14px] text-muted">{PHASE_LABEL[p].detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>

        <p role="status" aria-live="polite" className="text-[13px] text-muted">
          Current phase:{" "}
          <strong className="font-semibold text-ink">{PHASE_LABEL[PHASES[current]!].label}</strong>.
          This page checks automatically. ARCHMAP does not measure a completion percentage, so none
          is shown.
          {stale && " The last check failed; retrying."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {canManage && (
            <button type="button" className="am-btn" onClick={cancel} disabled={busy !== null}>
              <Ban size={16} aria-hidden="true" />{" "}
              {busy === "cancel" ? "Cancelling…" : "Cancel analysis"}
            </button>
          )}
          <Link href="/demo" className="am-btn">
            Explore the demo meanwhile
          </Link>
        </div>
      </div>
    </Centered>
  );
}

export function FailedScreen({ summary }: { summary: AnalysisSummary }) {
  const code: ErrorCode = summary.error?.code ?? "internal";
  const copy = ERROR_COPY[code];
  return (
    <Centered>
      <StateCard
        headingLevel={1}
        role="alert"
        tone="danger"
        icon={<AlertTriangle size={28} aria-hidden="true" className="text-danger" />}
        title={`Analysis failed: ${copy.title}`}
        actions={<RecoveryActions copy={copy} href={importHref(summary)} onRetry={undefined} />}
      >
        <p>{copy.message}</p>
        <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt>Repository</dt>
          <dd className="break-all text-ink">
            {summary.repository.owner}/{summary.repository.repo}
          </dd>
          <dt>Error code</dt>
          <dd className="text-ink">
            <code>{code}</code>
          </dd>
          {summary.error?.message && (
            <>
              <dt>Detail</dt>
              <dd className="break-words text-ink">{summary.error.message}</dd>
            </>
          )}
          <dt>Failed at</dt>
          <dd className="text-ink">{formatDateTime(summary.updatedAt)}</dd>
        </dl>
      </StateCard>
    </Centered>
  );
}

export function CancelledScreen({ summary }: { summary: AnalysisSummary }) {
  return (
    <Centered>
      <StateCard
        headingLevel={1}
        icon={<Ban size={28} aria-hidden="true" />}
        title="This analysis was cancelled"
        actions={
          <>
            <Link href={importHref(summary)} className="am-btn am-btn-primary">
              Analyze again
            </Link>
            <Link href="/demo" className="am-btn">
              Explore the demo
            </Link>
          </>
        }
      >
        <p>
          The analysis of {summary.repository.owner}/{summary.repository.repo} was stopped before it
          produced a graph. Nothing was saved.
        </p>
      </StateCard>
    </Centered>
  );
}

export function ExpiredScreen({ summary }: { summary: AnalysisSummary | null }) {
  const copy = ERROR_COPY.expired;
  return (
    <Centered>
      <StateCard
        headingLevel={1}
        icon={<Clock size={28} aria-hidden="true" />}
        title={copy.title}
        actions={<RecoveryActions copy={copy} href={importHref(summary)} />}
      >
        <p>{copy.message}</p>
        {summary && (
          <p className="mt-2 text-[13px]">It expired {relativeTime(summary.expiresAt)}.</p>
        )}
      </StateCard>
    </Centered>
  );
}

export function NotFoundScreen() {
  const copy = ERROR_COPY.not_found;
  return (
    <Centered>
      <StateCard
        headingLevel={1}
        icon={<SearchX size={28} aria-hidden="true" />}
        title={copy.title}
        actions={<RecoveryActions copy={copy} />}
      >
        <p>{copy.message}</p>
      </StateCard>
    </Centered>
  );
}

export function ErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const copy = copyForError(error);
  return (
    <Centered>
      <StateCard
        headingLevel={1}
        role="alert"
        tone="danger"
        icon={<FileQuestion size={28} aria-hidden="true" className="text-danger" />}
        title={copy.title}
        actions={<RecoveryActions copy={copy} onRetry={onRetry} />}
      >
        <p>{copy.message}</p>
        {error instanceof Error && (
          <p className="mt-2 break-words text-[12px]">Detail: {error.message}</p>
        )}
      </StateCard>
    </Centered>
  );
}

export function DeleteIcon() {
  return <Trash2 size={16} aria-hidden="true" />;
}
