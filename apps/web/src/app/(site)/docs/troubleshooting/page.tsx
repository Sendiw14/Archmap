import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_LIMITS, ErrorCode } from "@archmap/contracts";
import { ERROR_COPY } from "../../../../lib/api/errors";
import { Doc, Table } from "../../../../components/docs/doc";
import { formatHours } from "../../../../lib/format";

export const metadata: Metadata = {
  title: "Troubleshooting",
  description: "Fix unresolved imports, CLI errors, hosted import errors and expired results.",
};

const RECOVERY: Record<string, string> = {
  edit: "Fix the input and submit again.",
  cli: "Run the CLI on your own machine.",
  retry: "Try again; it is usually temporary.",
  wait: "Wait, then try again.",
  none: "Nothing to retry.",
};

export default function Troubleshooting() {
  return (
    <Doc
      path="/docs/troubleshooting"
      title="Troubleshooting"
      lead="Most surprises fall into a few groups: imports the analyzer cannot resolve, limits, and hosted-service states."
    >
      <h2 id="cli">CLI problems</h2>
      <h3>&quot;requires &gt;= 22.18&quot; or a syntax error on start</h3>
      <p>
        The CLI runs TypeScript directly through Node&apos;s type stripping. Run{" "}
        <code>node --version</code>; if it is older than 22.18, upgrade. <code>archmap doctor</code>{" "}
        checks this.
      </p>
      <h3>Exit code 2</h3>
      <p>
        Invalid input: an unknown option, <code>--format</code> other than <code>json</code> or{" "}
        <code>markdown</code>, a non-positive number for <code>--max-files</code> or{" "}
        <code>--max-file-bytes</code>, or a path that is not a readable directory. The message on
        standard error names the problem.
      </p>
      <h3>Exit code 1</h3>
      <p>
        The analysis itself failed. Re-run without <code>-q</code> to see the error. Report
        reproducible failures through the repository&apos;s issue tracker.
      </p>
      <h3>Fewer files than expected</h3>
      <p>
        Default ignores (<code>node_modules</code>, <code>dist</code>, <code>build</code>,{" "}
        <code>.next</code> and similar), your <code>-e</code> patterns, the <code>--max-files</code>{" "}
        cap and the <code>--max-file-bytes</code> cap all reduce the count. The summary shows
        discovered, analyzed, excluded and skipped counts in the JSON metadata and in the
        report&apos;s Scope section.
      </p>

      <h2 id="unresolved">Unresolved imports</h2>
      <p>
        An unresolved import is not an error in your code; it means the analyzer could not map the
        specifier. Common causes:
      </p>
      <ul>
        <li>
          <strong>Build-time aliases.</strong> Aliases defined only in webpack, Vite or Babel config
          are not read. Declare them in <code>tsconfig</code> <code>paths</code> for ARCHMAP.
        </li>
        <li>
          <strong>Generated files.</strong> Imports of files that exist only after a build (for
          example generated clients) are not present in the checkout.
        </li>
        <li>
          <strong>Case differences.</strong> <code>./Utils</code> for a file named{" "}
          <code>utils.ts</code> works on a case-insensitive disk and fails on Linux. ARCHMAP reports
          it as unresolved everywhere.
        </li>
        <li>
          <strong>Non-JavaScript assets.</strong> CSS, images and framework single-file components
          are not analyzed.
        </li>
        <li>
          <strong>Dependencies not installed.</strong> A package that is not in the analyzed tree
          cannot be resolved to a node.
        </li>
        <li>
          <strong>
            <code>extends</code> from a package.
          </strong>{" "}
          A <code>tsconfig</code> that extends a config inside <code>node_modules</code> produces a{" "}
          <code>config-error</code> diagnostic and its settings are not applied.
        </li>
      </ul>
      <p>
        The <Link href="/demo">workspace</Link> lists every unresolved import with its file, line
        and statement, under Cycles in the left panel and on the Insights page.
      </p>

      <h2 id="limitations">&quot;Completed with limitations&quot;</h2>
      <p>
        The result is usable. It means at least one import was unresolved or at least one warning,
        error or unsupported expression was recorded. Open the Report page for the diagnostics.
      </p>

      <h2 id="hosted-errors">Hosted import errors</h2>
      <p>
        Every error code the hosted API can return, what it means and what to do. The web app shows
        these messages itself.
      </p>
      <Table
        caption="Hosted API error codes"
        head={["Code", "What you see", "What to do"]}
        rows={ErrorCode.options.map((code) => [
          <code key={code}>{code}</code>,
          <>
            <strong>{ERROR_COPY[code].title}.</strong> {ERROR_COPY[code].message}
          </>,
          <>
            {ERROR_COPY[code].actionLabel}. {RECOVERY[ERROR_COPY[code].action]}
          </>,
        ])}
      />

      <h2 id="states">Analysis page states</h2>
      <ul>
        <li>
          <strong>In progress.</strong> The page shows the current phase (queued, fetching,
          analyzing, saving) and refreshes by itself. There is no percentage because none is
          measured.
        </li>
        <li>
          <strong>Failed.</strong> The page shows the reason and a recovery step. Run it again, or
          use the CLI for repositories over the limits.
        </li>
        <li>
          <strong>Cancelled.</strong> Someone with the management capability stopped it. Nothing was
          saved.
        </li>
        <li>
          <strong>Expired or not found.</strong> Results are deleted after{" "}
          {formatHours(DEFAULT_LIMITS.retentionHours)}, or earlier if the creator deleted them.
          Analyze again.
        </li>
        <li>
          <strong>Cannot cancel or delete.</strong> Only the browser that created an analysis holds
          the management cookie. If you cleared cookies, switched browser or the result was reused
          from an earlier request, the buttons are absent or the server refuses. The result will
          still expire on schedule.
        </li>
      </ul>

      <h2 id="browser">Browser and display</h2>
      <ul>
        <li>
          The graph is big or slow: use the List view, the explorer tree or search. Large graphs
          start grouped by folder; click a group to expand it.
        </li>
        <li>
          Animations bother you: ARCHMAP follows your system&apos;s reduced-motion setting and
          removes non-essential motion.
        </li>
        <li>
          Copy buttons do nothing: the browser blocked clipboard access. Select the text and copy it
          manually.
        </li>
      </ul>
    </Doc>
  );
}
