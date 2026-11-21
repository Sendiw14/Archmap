"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, GitBranch, Info } from "lucide-react";
import { api, type HealthStatus } from "../../lib/api/client";
import { ApiClientError, copyForError, type ErrorCopy } from "../../lib/api/errors";
import { rememberManage } from "../../lib/api/session";
import { validateImport } from "../../lib/import-validation";
import { Callout, Spinner } from "../ui/primitives";

interface Failure {
  error: unknown;
  copy: ErrorCopy;
  /** Which field the server's code points at. */
  field: "repository" | "ref" | null;
}

const FIELD_FOR_CODE: Partial<Record<string, "repository" | "ref">> = {
  invalid_repository: "repository",
  unsupported_provider: "repository",
  repository_not_found: "repository",
  repository_not_public: "repository",
  ref_not_found: "ref",
  invalid_request: "repository",
};

export function ImportForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [repository, setRepository] = useState(params.get("repo") ?? "");
  const [ref, setRef] = useState(params.get("ref") ?? "");
  const [errors, setErrors] = useState<{ repository?: string; ref?: string }>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [health, setHealth] = useState<HealthStatus | "checking">("checking");
  const repoInput = useRef<HTMLInputElement>(null);
  const refInput = useRef<HTMLInputElement>(null);
  const alertBox = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  // Advisory only: the real answer comes from the POST, but a down service is worth saying early.
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .health({ signal: ctrl.signal })
      .then(setHealth)
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  useEffect(() => () => abort.current?.abort(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFailure(null);
    const result = validateImport({ repository, ref });
    if (!result.ok) {
      setErrors(result.errors);
      (result.errors.repository ? repoInput : refInput).current?.focus();
      return;
    }
    setErrors({});
    setSubmitting(true);
    abort.current = new AbortController();
    try {
      const res = await api.createAnalysis(result.request, { signal: abort.current.signal });
      rememberManage(res.analysis.id, res.canManage);
      router.push(`/analyses/${res.analysis.id}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.kind === "aborted") return;
      const copy = copyForError(err);
      const field =
        err instanceof ApiClientError && err.code ? (FIELD_FOR_CODE[err.code] ?? null) : null;
      setFailure({ error: err, copy, field });
      if (field === "repository") setErrors({ repository: copy.message });
      else if (field === "ref") setErrors({ ref: copy.message });
      setSubmitting(false);
      requestAnimationFrame(() => alertBox.current?.focus());
    }
  };

  const serviceDown = health === "unavailable";
  const code = failure?.error instanceof ApiClientError ? failure.error.code : null;

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-describedby="import-status"
      className="am-card p-5 sm:p-7"
    >
      <div id="import-status" className="space-y-3 empty:hidden">
        {serviceDown && (
          <Callout tone="warning" title="The hosted analysis service is not reachable right now">
            You can still use the <Link href="/demo">demo</Link> or analyze locally with the{" "}
            <Link href="/docs/cli">CLI</Link>. Submitting here will probably fail until the service
            is back.
          </Callout>
        )}
        {health === "degraded" && (
          <Callout title="The service reports degraded health">
            Analyses may be slow or refused. The CLI is unaffected.
          </Callout>
        )}
      </div>

      <div className={serviceDown || health === "degraded" ? "mt-5" : ""}>
        <label htmlFor="repository" className="font-display text-[15px] font-semibold">
          GitHub repository
        </label>
        <div className="relative mt-2">
          <GitBranch
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref={repoInput}
            id="repository"
            name="repository"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            required
            maxLength={300}
            placeholder="owner/repo or https://github.com/owner/repo"
            className="am-field min-h-12 pl-10 text-[15px]"
            value={repository}
            disabled={submitting}
            aria-invalid={errors.repository ? true : undefined}
            aria-describedby={
              errors.repository ? "repository-error repository-hint" : "repository-hint"
            }
            onChange={(e) => {
              setRepository(e.target.value);
              if (errors.repository) setErrors((x) => ({ ...x, repository: undefined }));
            }}
          />
        </div>
        <p id="repository-hint" className="mt-1.5 text-[13px] text-muted">
          Public repositories on github.com only. Examples: <code>vercel/next.js</code>,{" "}
          <code>github.com/vitejs/vite</code>.
        </p>
        {errors.repository && (
          <p
            id="repository-error"
            role="alert"
            className="mt-1.5 flex items-start gap-1.5 text-[14px] font-medium text-danger"
          >
            <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 flex-none" />{" "}
            {errors.repository}
          </p>
        )}
      </div>

      <details
        className="mt-5 rounded-xl border border-line bg-surface px-4 py-2"
        open={!!ref || !!errors.ref}
      >
        <summary className="flex min-h-9 cursor-pointer items-center text-[14px] font-medium">
          Advanced options
        </summary>
        <div className="pb-3 pt-2">
          <label htmlFor="ref" className="text-[14px] font-medium">
            Branch, tag or commit (optional)
          </label>
          <input
            ref={refInput}
            id="ref"
            name="ref"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={200}
            placeholder="default branch"
            className="am-field mt-1.5"
            value={ref}
            disabled={submitting}
            aria-invalid={errors.ref ? true : undefined}
            aria-describedby={errors.ref ? "ref-error ref-hint" : "ref-hint"}
            onChange={(e) => {
              setRef(e.target.value);
              if (errors.ref) setErrors((x) => ({ ...x, ref: undefined }));
            }}
          />
          <p id="ref-hint" className="mt-1.5 text-[13px] text-muted">
            Leave empty for the default branch. The commit SHA is resolved first and recorded, so
            the result stays tied to exactly that commit. A branch inside a <code>/tree/…</code> URL
            is ignored; type it here instead.
          </p>
          {errors.ref && (
            <p
              id="ref-error"
              role="alert"
              className="mt-1.5 flex items-start gap-1.5 text-[14px] font-medium text-danger"
            >
              <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 flex-none" />{" "}
              {errors.ref}
            </p>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-[13px] text-muted">
            <Info size={14} aria-hidden="true" className="mt-0.5 flex-none" />
            Analyzer settings (excluded folders, file limits) are fixed for hosted analyses. The CLI
            lets you change them.
          </p>
        </div>
      </details>

      {failure && (
        <div
          ref={alertBox}
          tabIndex={-1}
          role="alert"
          className="mt-5 rounded-xl border border-danger/40 bg-danger-soft p-4 outline-none"
        >
          <p className="flex items-start gap-2 font-display text-[15px] font-semibold text-danger">
            <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 flex-none" />{" "}
            {failure.copy.title}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed">{failure.copy.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {failure.copy.action === "cli" && (
              <Link href="/docs/cli" className="am-btn am-btn-sm am-btn-primary">
                {failure.copy.actionLabel}
              </Link>
            )}
            {(failure.copy.action === "retry" || failure.copy.action === "wait") && (
              <button type="submit" className="am-btn am-btn-sm am-btn-primary">
                {failure.copy.actionLabel}
              </button>
            )}
            {failure.copy.action === "edit" && (
              <button
                type="button"
                className="am-btn am-btn-sm am-btn-primary"
                onClick={() => (failure.field === "ref" ? refInput : repoInput).current?.focus()}
              >
                {failure.copy.actionLabel}
              </button>
            )}
            {code && ["rate_limited", "imports_disabled", "queue_full"].includes(code) && (
              <Link href="/demo" className="am-btn am-btn-sm">
                Explore the demo meanwhile
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="am-btn am-btn-primary min-h-12 px-6 text-[15px]"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <Spinner /> Starting analysis&hellip;
            </>
          ) : (
            <>
              Analyze repository <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
        <p className="text-[13px] text-muted" role="status">
          {submitting
            ? "Sending the request. You will be taken to the live status page."
            : "No account needed."}
        </p>
      </div>
    </form>
  );
}
