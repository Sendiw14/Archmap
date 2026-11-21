import type { Metadata } from "next";
import Link from "next/link";
import { Doc } from "../../../components/docs/doc";
import { DOC_LINKS } from "../../../components/docs/links";
import { DEFAULT_LIMITS } from "@archmap/contracts";
import { formatHours } from "../../../lib/format";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "How to run ARCHMAP, what it analyzes, how its algorithms work and how to fix common problems.",
};

const BLURB: Record<string, string> = {
  "/docs/getting-started": "Install, analyze a repository, read the result.",
  "/docs/cli": "Every command, option and exit code, with examples.",
  "/docs/architecture":
    "The analysis pipeline, the graph schema, the algorithms and the hosted API.",
  "/docs/analysis-coverage": "Exactly which import constructs are understood, and which are not.",
  "/docs/troubleshooting": "Unresolved imports, limits, hosted errors and how to recover.",
};

export default function DocsIndex() {
  return (
    <Doc
      crumbs={[{ href: "/", label: "Home" }, { label: "Docs" }]}
      pager={false}
      title="Documentation"
      lead="ARCHMAP reads JavaScript and TypeScript source, resolves every import the way TypeScript does, and reports the dependency graph with the source line behind each edge."
    >
      <h2>Two ways to use it</h2>
      <ul>
        <li>
          <strong>Locally, with the CLI.</strong> Runs on your machine, needs no account, and never
          uploads anything. This is the complete feature set and works on private code.
        </li>
        <li>
          <strong>Hosted, for public GitHub repositories.</strong>{" "}
          <Link href="/import">Import</Link> a repository and get a shareable web workspace. Results
          are deleted after {formatHours(DEFAULT_LIMITS.retentionHours)}. Whether hosted import is
          available depends on the deployment.
        </li>
      </ul>
      <p>
        Want to look first? The <Link href="/demo">demo</Link> runs the same workspace on real
        analyzer output, with no setup.
      </p>
      <h2>Where to go</h2>
      <ul>
        {DOC_LINKS.filter((l) => l.href !== "/docs").map((l) => (
          <li key={l.href}>
            <Link href={l.href}>{l.label}</Link>: {BLURB[l.href]}
          </li>
        ))}
      </ul>
      <h2>Principles</h2>
      <ul>
        <li>Analysis is static and syntax-only. Repository code is never executed.</li>
        <li>
          Output is deterministic: the same repository and options give the same graph. The only
          varying field is a timestamp, which <code>--reproducible</code> removes.
        </li>
        <li>Edges point from the importing module to the imported module, everywhere.</li>
        <li>
          Every finding keeps the evidence that supports it, and every limitation is documented.
        </li>
      </ul>
    </Doc>
  );
}
