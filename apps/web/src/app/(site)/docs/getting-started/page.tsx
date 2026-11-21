import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "../../../../components/docs/code-block";
import { Doc } from "../../../../components/docs/doc";

export const metadata: Metadata = {
  title: "Getting started",
  description: "Install ARCHMAP, analyze a repository from the command line and read the result.",
};

export default function GettingStarted() {
  return (
    <Doc
      path="/docs/getting-started"
      title="Getting started"
      lead="From a clone of the repository to your first dependency graph in a few commands."
    >
      <h2 id="requirements">Requirements</h2>
      <ul>
        <li>
          Node.js 22.18 or newer. ARCHMAP runs its TypeScript sources directly with Node&apos;s
          native type stripping, so there is no build step.
        </li>
        <li>pnpm 9.</li>
      </ul>
      <p>
        ARCHMAP is not published to a package registry yet, so you run it from a clone of its
        repository. Check your environment at any time with <code>doctor</code> (below).
      </p>

      <h2 id="install">Install</h2>
      <CodeBlock label="Install dependencies">{`pnpm install`}</CodeBlock>

      <h2 id="first-analysis">Analyze a repository</h2>
      <p>
        Point the CLI at the root of any JavaScript or TypeScript project. Nothing is uploaded and
        no project code is run.
      </p>
      <CodeBlock label="Print a Markdown report">{`pnpm archmap analyze path/to/repo -f markdown`}</CodeBlock>
      <p>Write the full graph as JSON, with no timestamp so repeated runs are byte-identical:</p>
      <CodeBlock label="Write the graph as JSON">{`pnpm archmap analyze path/to/repo -o graph.json --reproducible`}</CodeBlock>
      <p>
        On a small fixture with a circular import, the CLI prints a one-line summary on standard
        error and the graph on standard output. This is real output:
      </p>
      <CodeBlock label="Example summary line">{`$ pnpm archmap analyze fixtures/circular --reproducible -o graph.json
completed: 4 files, 4 edges, 1 runtime cycle(s), 0 unresolved, 0 diagnostic(s) -> graph.json`}</CodeBlock>

      <h2 id="read">Read the result</h2>
      <ul>
        <li>
          <strong>Status.</strong> <code>completed</code>, or{" "}
          <code>completed_with_limitations</code> when some imports could not be resolved or
          something was skipped. The CLI exits <code>0</code> for both.
        </li>
        <li>
          <strong>Cycles.</strong> A runtime cycle means modules import each other in a loop through
          imports that exist at runtime. A type-only cycle only exists through{" "}
          <code>import type</code> and is erased at runtime.
        </li>
        <li>
          <strong>Unresolved imports.</strong> Statements the analyzer found but could not map to a
          file or package. They are listed, never silently dropped. See{" "}
          <Link href="/docs/troubleshooting">troubleshooting</Link>.
        </li>
        <li>
          <strong>Evidence.</strong> Every edge records the file, line, column and the statement
          text that created it.
        </li>
      </ul>

      <h2 id="check">Check your setup</h2>
      <CodeBlock label="Run the environment check">{`$ pnpm archmap doctor
ok   node 24.11.1 (requires >= 22.18 for type stripping)
ok   analyzer 0.1.0, schema 1.0.0
ok   compiler typescript@6.0.2
ok   platform darwin/arm64`}</CodeBlock>

      <h2 id="explore">Explore the graph</h2>
      <ul>
        <li>
          The <Link href="/demo">demo</Link> shows the workspace on real analyzer output: select
          modules, follow evidence, investigate cycles and see potential change impact.
        </li>
        <li>
          For a <em>public GitHub</em> repository you can skip the CLI and use{" "}
          <Link href="/import">hosted import</Link>.
        </li>
        <li>
          The JSON file follows the <Link href="/docs/architecture#schema">graph schema</Link>, so
          you can script against it.
        </li>
      </ul>

      <h2 id="next">Next</h2>
      <p>
        The <Link href="/docs/cli">CLI reference</Link> lists every option.{" "}
        <Link href="/docs/analysis-coverage">Analysis coverage</Link> says what is and is not
        understood.
      </p>
    </Doc>
  );
}
