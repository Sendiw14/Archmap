import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_LIMITS } from "@archmap/contracts";
import { Doc, Table } from "../../../components/docs/doc";
import { formatCount, formatDuration, formatHours, formatMiB } from "../../../lib/format";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How ARCHMAP treats repositories as untrusted input, what is enforced today, and how to report a vulnerability.",
};

const L = DEFAULT_LIMITS;

export default function Security() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
      <Doc
        pager={false}
        crumbs={[{ href: "/", label: "Home" }, { label: "Security" }]}
        title="Security"
        lead="Every repository is untrusted input. ARCHMAP reads it as text, never runs it, and keeps hosted analysis small, isolated and short-lived."
      >
        <h2 id="stance">Stance</h2>
        <ul>
          <li>
            The analyzer parses syntax only. It never executes repository code, configuration,
            scripts, plugins or install hooks.
          </li>
          <li>It never reads outside the repository root and never follows symbolic links.</li>
          <li>
            Local use sends nothing anywhere. Hosted import accepts public GitHub repositories only.
          </li>
          <li>
            Results are shareable by URL, expire after {formatHours(L.retentionHours)}, and can be
            deleted early by the browser that created them.
          </li>
          <li>No source code is forwarded to any AI provider.</li>
        </ul>

        <h2 id="analyzer">Analyzer controls</h2>
        <Table
          caption="Analyzer threats and controls"
          head={["Threat", "Control"]}
          rows={[
            [
              <>
                Reading files outside the repo through <code>../</code> or absolute specifiers
              </>,
              "The resolver only answers from the set of files inside the root.",
            ],
            [
              "Symlink escape",
              <>
                The walk uses <code>lstat</code>; symlinks are skipped and reported as a diagnostic.
              </>,
            ],
            [
              <>
                <code>tsconfig</code> <code>extends</code> pointing outside the repo
              </>,
              "Config reads go through the same root-confined host.",
            ],
            [
              "Executing repository code",
              "Syntax-only parsing. No require or import of repository files, and no child process in the analyzer.",
            ],
            [
              "Resource exhaustion",
              <>
                Caps on file size ({formatMiB(L.maxFileBytes)}) and file count (
                {formatCount(L.maxFiles)}).
              </>,
            ],
            [
              "Deep recursion on huge graphs",
              "The cycle algorithm is iterative and is tested on 50,000 nodes.",
            ],
            [
              "Source leakage through results",
              "Evidence stores one statement of at most 160 characters, not file contents.",
            ],
            [
              "Markdown injection in reports",
              "Characters that change Markdown meaning are escaped in interpolated values.",
            ],
            [
              "Dependency and CI compromise",
              "Lockfile, dependency audit in CI, pinned workflow actions, read-only workflow permissions.",
            ],
          ]}
        />

        <h2 id="hosted">Hosted import controls</h2>
        <p>
          Each control below is covered by automated tests (adversarial archives, forged and
          cross-origin management requests, quotas, timeouts, expiry) and was exercised against real
          Postgres, Redis and S3-compatible storage. One gap remains: restricting the worker&apos;s
          outbound network to GitHub is a deployment-level policy, not something the application can
          enforce.
        </p>
        <ul>
          <li>
            <strong>Strict input.</strong> Only <code>owner/repo</code> and github.com URLs are
            accepted, parsed by one shared function in the browser and on the server. Other hosts,
            schemes, credentials in URLs and unusual refs are rejected before any request is made.
          </li>
          <li>
            <strong>Allow-listed acquisition.</strong> Source is fetched from GitHub only, with
            redirects validated, so a user-supplied URL cannot make the server contact an arbitrary
            host.
          </li>
          <li>
            <strong>Safe extraction and budgets.</strong> Archive traversal, link escapes and
            decompression bombs are guarded by the limits below: {formatMiB(L.maxArchiveBytes)}{" "}
            compressed, {formatMiB(L.maxExtractedBytes)} extracted,{" "}
            {formatCount(L.maxArchiveEntries)} entries, {formatCount(L.maxFiles)} source files,{" "}
            {formatMiB(L.maxFileBytes)} per file, {formatDuration(L.analysisTimeoutMs)} of analysis,
            about {formatMiB(L.workerMemoryMb * 1024 * 1024)} of worker memory,{" "}
            {L.workerConcurrency} concurrent jobs.
          </li>
          <li>
            <strong>Isolation.</strong> Analysis runs in a separate worker with no repository code
            execution, bounded CPU and memory, a timeout, and limited or no network access.
          </li>
          <li>
            <strong>Authorization.</strong> Viewing is independent of managing. Cancel and delete
            require a random capability of at least 256 bits, kept as an <code>HttpOnly</code>,{" "}
            <code>SameSite=Strict</code> cookie scoped to the analysis. The server stores only a
            verifier. Requests are origin-checked. Possession of a result URL alone cannot delete
            it.
          </li>
          <li>
            <strong>Abuse limits.</strong> {L.submissionsPerClientPerHour} new analyses per client
            per hour, a queue of at most {formatCount(L.maxQueueDepth)}, and a switch to disable
            imports if the service is under threat.
          </li>
          <li>
            <strong>Output safety.</strong> All repository text is escaped in HTML and Markdown. The
            SVG export is generated from layout data, escapes every string and contains no script,
            no <code>foreignObject</code>, no event attributes and no external references; it is
            checked before download.
          </li>
          <li>
            <strong>Retention.</strong> Results are deleted after {L.retentionHours} hours. Raw
            source archives are not kept after analysis.
          </li>
        </ul>

        <h2 id="web">This website</h2>
        <ul>
          <li>
            Response headers set a Content Security Policy that allows scripts, styles, workers and
            connections from this origin only, blocks framing (
            <code>frame-ancestors &apos;none&apos;</code>), objects and foreign form targets, plus{" "}
            <code>X-Content-Type-Options: nosniff</code>, a strict referrer policy and a restrictive
            permissions policy.
          </li>
          <li>
            The browser talks only to its own origin; the API is reached through a same-origin
            proxy, which is what lets the strict cookie and origin checks work.
          </li>
          <li>
            Analysis pages are served with <code>noindex</code>.
          </li>
        </ul>

        <h2 id="residual">Known limits</h2>
        <ul>
          <li>
            Pathological single files below the size cap are not benchmarked for parser denial of
            service.
          </li>
          <li>The local CLI has no wall-clock timeout.</li>
          <li>
            The Content Security Policy allows inline scripts, which the Next.js runtime needs; a
            nonce-based policy would require rendering every page dynamically.
          </li>
          <li>Anonymous management cannot be recovered after cookies are cleared.</li>
        </ul>

        <h2 id="report">Reporting a vulnerability</h2>
        <p>
          Report privately through GitHub Security Advisories on the project repository
          (&quot;Report a vulnerability&quot;). Please do not open a public issue for a security
          problem.
        </p>
        <p>
          See also <Link href="/privacy">privacy</Link> and the{" "}
          <Link href="/docs/architecture">architecture</Link>.
        </p>
      </Doc>
    </div>
  );
}
