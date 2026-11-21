import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_LIMITS } from "@archmap/contracts";
import { Doc } from "../../../components/docs/doc";
import { formatHours } from "../../../lib/format";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What ARCHMAP does and does not do with your code: local analysis stays local; hosted results are public by link and expire after a day.",
};

const hours = formatHours(DEFAULT_LIMITS.retentionHours);

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
      <Doc
        pager={false}
        crumbs={[{ href: "/", label: "Home" }, { label: "Privacy" }]}
        title="Privacy"
        lead="Short version: run it locally and your source never leaves your machine. Use hosted import and you are publishing a result about a public repository."
      >
        <h2 id="local">Local use (the CLI)</h2>
        <ul>
          <li>
            Your source code stays on your machine. The CLI never uploads, transmits or reports
            anything.
          </li>
          <li>There is no account, no sign-in and no telemetry.</li>
          <li>
            Analysis reads files without executing them, and does not read outside the directory you
            give it.
          </li>
        </ul>

        <h2 id="hosted">Hosted import</h2>
        <ul>
          <li>
            <strong>Public GitHub repositories only.</strong> Private repositories, other hosts and
            arbitrary URLs are rejected. Do not assume a public repository contains nothing
            sensitive: if you would not want it linked, do not analyze it here.
          </li>
          <li>
            <strong>Results are shareable by URL.</strong> Anyone with the analysis link can view
            the graph, the file paths, the dependency evidence and the report. Viewing does not need
            an account or any permission.
          </li>
          <li>
            <strong>{hours} retention.</strong> A result, and its link, stop working {hours} after
            the analysis. Expiry is automatic.
          </li>
          <li>
            <strong>Deletable by its creator.</strong> The browser that created an analysis can
            delete it, or cancel it while it runs, before it expires. That ability is a random token
            kept in an <code>HttpOnly</code> cookie scoped to that one analysis. It is not in the
            URL, so sharing the link never shares the ability to delete. If you clear cookies or
            switch browsers, you cannot delete early; the result still expires.
          </li>
          <li>
            <strong>No AI processing.</strong> No source code, path or result is sent to any AI
            provider or any other third party.
          </li>
          <li>
            <strong>No code execution.</strong> The repository is downloaded as an archive and read
            as text. Its scripts, install hooks, build steps and configuration are never run.
          </li>
        </ul>

        <h2 id="stored">What a hosted result contains</h2>
        <ul>
          <li>The repository owner and name, the resolved commit SHA and the ref you asked for.</li>
          <li>
            The dependency graph: file paths, package names, import specifiers and, for each import,
            the file, line, column and the single statement (at most 160 characters).
          </li>
          <li>Findings, diagnostics and versions.</li>
          <li>
            It does not contain the full contents of your files. The downloaded archive is a working
            file for the analysis and is not kept as a product.
          </li>
        </ul>
        <p>
          Operationally, the service also sees the usual request information needed to run it, such
          as your network address for the per-hour submission limit. That address is stored only as
          a keyed hash used for rate limiting, and request logs must not contain source code or
          secrets.
        </p>

        <h2 id="browser">In your browser</h2>
        <ul>
          <li>
            The site stores a small flag in <code>sessionStorage</code> to know whether to show
            Cancel and Delete. It ends with the tab.
          </li>
          <li>
            The demo remembers in <code>localStorage</code> that you dismissed its walkthrough.
          </li>
          <li>No analytics or advertising scripts are loaded.</li>
        </ul>

        <h2 id="indexing">Search engines</h2>
        <p>
          Analysis pages are marked <code>noindex</code>, so well-behaved crawlers will not list
          them. They are still reachable by anyone who has the link.
        </p>

        <p>
          Questions about how this works are answered in more detail on the{" "}
          <Link href="/security">security page</Link> and in{" "}
          <Link href="/docs/architecture">the architecture docs</Link>.
        </p>
      </Doc>
    </div>
  );
}
