"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ban, CircleHelp, FileDown } from "lucide-react";
import { Badge } from "../ui/primitives";
import { CopyButton } from "../ui/copy-button";
import { Dialog } from "../ui/dialog";
import { formatDateTime, relativeTime, shortSha } from "../../lib/format";
import type { AnalysisMeta } from "../../lib/analysis-source";
import { AnalysisProvider, useAnalysis } from "./provider";
import {
  CancelledScreen,
  DeleteIcon,
  ErrorScreen,
  ExpiredScreen,
  FailedScreen,
  LoadingScreen,
  NotFoundScreen,
  PendingScreen,
} from "./states";
import { HelpDialog } from "./help-dialog";

const TABS = [
  { slug: "", label: "Graph" },
  { slug: "/insights", label: "Insights" },
  { slug: "/files", label: "Files" },
  { slug: "/report", label: "Report" },
] as const;

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  completed: "success",
  completed_with_limitations: "warning",
  failed: "danger",
  cancelled: "neutral",
  expired: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  completed_with_limitations: "Completed with limitations",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
  queued: "Queued",
  fetching: "Fetching",
  analyzing: "Analyzing",
  persisting: "Saving",
};

export function AnalysisShell({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <AnalysisProvider id={id}>
      <ShellInner>{children}</ShellInner>
    </AnalysisProvider>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { id, view, retry } = useAnalysis();
  const pathname = usePathname();
  const base = `/analyses/${id}`;
  const workspace = pathname === base;

  if (view.state === "ready") {
    return (
      <div className={workspace ? "flex flex-col lg:h-[calc(100dvh-3.5rem)]" : ""}>
        <AnalysisHeader meta={view.meta} />
        <div className={workspace ? "flex min-h-0 flex-1 flex-col" : ""}>{children}</div>
      </div>
    );
  }
  return (
    <div>
      {view.state === "loading" && <LoadingScreen message={view.message} />}
      {view.state === "pending" && <PendingScreen summary={view.summary} stale={view.stale} />}
      {view.state === "failed" && <FailedScreen summary={view.summary} />}
      {view.state === "cancelled" && <CancelledScreen summary={view.summary} />}
      {view.state === "expired" && <ExpiredScreen summary={view.summary} />}
      {view.state === "not_found" && <NotFoundScreen />}
      {view.state === "error" && <ErrorScreen error={view.error} onRetry={retry} />}
    </div>
  );
}

function AnalysisHeader({ meta }: { meta: AnalysisMeta }) {
  const { id, canManage, cancel, remove, busy } = useAnalysis();
  const pathname = usePathname();
  const [help, setHelp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const base = `/analyses/${id}`;
  const demo = meta.source === "demo";
  const tone = STATUS_TONE[meta.status] ?? "neutral";
  const running = meta.status !== "completed" && meta.status !== "completed_with_limitations";

  return (
    <header className="am-no-print border-b border-line bg-bg">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="am-eyebrow">
            {demo
              ? meta.synthetic
                ? "Synthetic benchmark graph"
                : "Demonstration data"
              : "Analysis"}
          </p>
          <h1
            className="truncate font-display text-lg font-semibold leading-tight tracking-tight"
            title={meta.repoLabel}
          >
            {meta.repoUrl ? (
              <a
                href={meta.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {meta.repoLabel}
              </a>
            ) : (
              meta.repoLabel
            )}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton
            text={() => `${window.location.origin}${base}`}
            label="Share"
            copiedLabel="Link copied"
            announce="Link to this analysis copied. Anyone with the link can view it."
            className="am-btn"
          />
          <Link href={`${base}/report#exports`} className="am-btn">
            <FileDown size={16} aria-hidden="true" /> Export
          </Link>
          <button type="button" className="am-btn" onClick={() => setHelp(true)}>
            <CircleHelp size={16} aria-hidden="true" /> Help
          </button>
          {canManage && running && (
            <button type="button" className="am-btn" onClick={cancel} disabled={busy !== null}>
              <Ban size={16} aria-hidden="true" /> Cancel
            </button>
          )}
          {canManage && (
            <button
              type="button"
              className="am-btn text-danger"
              onClick={() => setConfirmDelete(true)}
              disabled={busy !== null}
            >
              <DeleteIcon /> Delete
            </button>
          )}
        </div>
      </div>

      <dl className="mx-auto mt-2 hidden max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-1 px-4 text-[13px] text-muted sm:px-6 md:flex">
        <Meta label="Status">
          <Badge tone={tone}>{STATUS_LABEL[meta.status] ?? meta.status}</Badge>
        </Meta>
        {meta.commit && (
          <Meta label="Commit">
            <code className="text-ink" title={meta.commit}>
              {shortSha(meta.commit)}
            </code>
            <CopyButton
              text={meta.commit}
              iconOnly
              ariaLabel="Copy full commit SHA"
              announce="Commit SHA copied"
              className="am-btn am-btn-quiet am-btn-sm !min-h-7 !px-1.5"
            />
          </Meta>
        )}
        {meta.ref && (
          <Meta label="Ref">
            <code className="text-ink">{meta.ref}</code>
          </Meta>
        )}
        <Meta label="Analyzer">
          <span>
            <span className="text-ink">{meta.analyzerVersion}</span>, schema{" "}
            <span className="text-ink">{meta.schemaVersion}</span>
          </span>
        </Meta>
        <Meta label="Analyzed">
          <time dateTime={meta.createdAt ?? undefined} className="text-ink">
            {meta.createdAt ? formatDateTime(meta.createdAt) : "reproducible build, no timestamp"}
          </time>
        </Meta>
        {meta.expiresAt && (
          <Meta label="Expires">
            <time dateTime={meta.expiresAt} className="text-ink">
              {relativeTime(meta.expiresAt)}
            </time>
          </Meta>
        )}
      </dl>
      <details className="mx-auto mt-1 max-w-[1600px] px-4 text-[13px] text-muted sm:px-6 md:hidden">
        <summary className="inline-flex min-h-9 cursor-pointer items-center gap-2">
          <Badge tone={tone}>{STATUS_LABEL[meta.status] ?? meta.status}</Badge>
          <span className="underline underline-offset-2">Analysis details</span>
        </summary>
        <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 pb-2">
          {meta.commit && (
            <>
              <dt>Commit</dt>
              <dd className="flex items-center gap-1 text-ink">
                <code>{shortSha(meta.commit)}</code>
                <CopyButton
                  text={meta.commit}
                  iconOnly
                  ariaLabel="Copy full commit SHA"
                  announce="Commit SHA copied"
                  className="am-btn am-btn-quiet am-btn-sm !min-h-7 !px-1.5"
                />
              </dd>
            </>
          )}
          <dt>Analyzer</dt>
          <dd className="text-ink">
            {meta.analyzerVersion}, schema {meta.schemaVersion}
          </dd>
          <dt>Analyzed</dt>
          <dd className="text-ink">
            {meta.createdAt ? formatDateTime(meta.createdAt) : "no timestamp (reproducible)"}
          </dd>
          {meta.expiresAt && (
            <>
              <dt>Expires</dt>
              <dd className="text-ink">{relativeTime(meta.expiresAt)}</dd>
            </>
          )}
        </dl>
      </details>

      <nav
        aria-label="Analysis sections"
        className="mx-auto mt-1 flex max-w-[1600px] gap-1 overflow-x-auto px-4 sm:px-6"
      >
        {TABS.map((t) => {
          const href = `${base}${t.slug}`;
          const current = pathname === href;
          return (
            <Link
              key={t.slug}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${
                current
                  ? "border-primary-strong text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {help && <HelpDialog onClose={() => setHelp(false)} />}
      {confirmDelete && (
        <Dialog
          title="Delete this analysis?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button
                type="button"
                className="am-btn"
                onClick={() => setConfirmDelete(false)}
                data-autofocus
              >
                Keep it
              </button>
              <button
                type="button"
                className="am-btn am-btn-primary !border-danger !bg-danger"
                disabled={busy !== null}
                onClick={async () => {
                  await remove();
                  setConfirmDelete(false);
                }}
              >
                {busy === "delete" ? "Deleting…" : "Delete permanently"}
              </button>
            </>
          }
        >
          <p>
            The graph and its shareable link stop working immediately, for everyone who has the
            link. This cannot be undone.
          </p>
        </Dialog>
      )}
    </header>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="flex items-center gap-1">{children}</dd>
    </div>
  );
}
