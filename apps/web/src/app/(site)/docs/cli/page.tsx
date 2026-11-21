import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "../../../../components/docs/code-block";
import { Doc, Table } from "../../../../components/docs/doc";

export const metadata: Metadata = {
  title: "Command-line tool",
  description: "Every ARCHMAP CLI command, option and exit code, with examples.",
};

export default function CliDocs() {
  return (
    <Doc
      path="/docs/cli"
      title="Command-line tool"
      lead="The CLI is the complete local product: it analyzes a checkout on your machine and writes JSON or Markdown. It never uploads source code."
    >
      <h2 id="usage">Usage</h2>
      <CodeBlock label="CLI synopsis">{`archmap analyze [path] [-f json|markdown] [-o file] [-e glob...] [--max-files n] [--max-file-bytes n] [--reproducible] [-q]
archmap doctor`}</CodeBlock>
      <p>
        From a clone of the repository, <code>pnpm archmap</code> runs{" "}
        <code>node apps/cli/src/main.ts</code>, so every example below can be prefixed with{" "}
        <code>pnpm</code>.
      </p>

      <h2 id="analyze">archmap analyze</h2>
      <p>
        Analyzes the repository at <code>path</code> (default <code>.</code>) and prints a JSON
        graph or a Markdown report to standard output, or writes it to a file.
      </p>
      <Table
        caption="Options of archmap analyze"
        head={["Option", "Default", "Meaning"]}
        rows={[
          [
            <code key="a">[path]</code>,
            <code key="b">.</code>,
            "Repository root. The analyzer never reads outside it.",
          ],
          [
            <code key="a">-f, --format &lt;format&gt;</code>,
            <code key="b">json</code>,
            <>
              Output format: <code>json</code> or <code>markdown</code>. Anything else is a usage
              error.
            </>,
          ],
          [
            <code key="a">-o, --output &lt;file&gt;</code>,
            "standard output",
            "Write the result to a file instead of printing it.",
          ],
          [
            <code key="a">-e, --exclude &lt;glob...&gt;</code>,
            "none",
            "Exclude repository-relative globs. Repeat the option for several patterns.",
          ],
          [
            <code key="a">--max-files &lt;n&gt;</code>,
            <code key="b">10000</code>,
            "Maximum number of source files to analyze. Must be a positive integer.",
          ],
          [
            <code key="a">--max-file-bytes &lt;n&gt;</code>,
            <code key="b">2097152</code>,
            "Skip files larger than this many bytes (2 MiB by default).",
          ],
          [
            <code key="a">--reproducible</code>,
            "off",
            <>Omit the generation timestamp so the output is byte-identical across runs.</>,
          ],
          [<code key="a">-q, --quiet</code>, "off", "No progress output and no summary line."],
        ]}
      />
      <h3>What it prints</h3>
      <p>
        Unless <code>-q</code> is given, a one-line summary goes to <strong>standard error</strong>,
        so piping the graph from standard output stays clean. While analyzing in an interactive
        terminal it also shows a file counter, which is cleared when it finishes.
      </p>
      <CodeBlock label="Summary line format">{`<status>: <n> files, <n> edges, <n> runtime cycle(s), <n> unresolved, <n> diagnostic(s)[ -> <output file>]`}</CodeBlock>

      <h3>Examples</h3>
      <CodeBlock label="Markdown report to the terminal">{`archmap analyze . -f markdown`}</CodeBlock>
      <CodeBlock label="JSON graph, reproducible, to a file">{`archmap analyze . -o graph.json --reproducible`}</CodeBlock>
      <CodeBlock label="Exclude generated and test code">{`archmap analyze . -e 'dist/**' -e '**/*.test.ts' -e fixtures`}</CodeBlock>
      <CodeBlock label="Limit the analysis">{`archmap analyze . --max-files 2000 --max-file-bytes 524288 -q -o graph.json`}</CodeBlock>

      <h2 id="doctor">archmap doctor</h2>
      <p>
        Checks that Node.js is new enough (22.18 or later) and prints the analyzer, schema and
        compiler versions and the platform. It exits <code>1</code> if Node is too old.
      </p>
      <CodeBlock label="doctor output">{`ok   node 24.11.1 (requires >= 22.18 for type stripping)
ok   analyzer 0.1.0, schema 1.0.0
ok   compiler typescript@6.0.2
ok   platform darwin/arm64`}</CodeBlock>

      <h2 id="exit-codes">Exit codes</h2>
      <Table
        caption="CLI exit codes"
        head={["Code", "Meaning"]}
        rows={[
          [
            <code key="a">0</code>,
            <>
              Success, including <code>completed_with_limitations</code>. Limitations are reported,
              not treated as failure.
            </>,
          ],
          [
            <code key="a">1</code>,
            <>
              The analysis failed (status <code>failed</code> or an unexpected error), or{" "}
              <code>doctor</code> found an unsupported Node.js.
            </>,
          ],
          [
            <code key="a">2</code>,
            <>
              Invalid input: an unknown option or format, a non-positive number, or a path the
              analyzer rejects.
            </>,
          ],
        ]}
      />

      <h2 id="output">Output</h2>
      <ul>
        <li>
          <strong>JSON</strong> is the graph described in the{" "}
          <Link href="/docs/architecture#schema">schema reference</Link>: nodes, edges with
          evidence, findings, diagnostics and coverage.
        </li>
        <li>
          <strong>Markdown</strong> is a deterministic report derived only from the graph: identity,
          summary, cycles, hotspots, package dependencies, unresolved imports, diagnostics and
          limitations. The web report page uses the same renderer.
        </li>
      </ul>

      <h2 id="determinism">Determinism and safety</h2>
      <ul>
        <li>
          Nodes, edges and findings are sorted, and ids are derived from content, so the same input
          gives the same graph.
        </li>
        <li>
          Files are read syntax-only. No repository code, config or script is executed, and symbolic
          links are not followed.
        </li>
        <li>
          By default these directories are skipped: <code>node_modules</code>, <code>.git</code>,{" "}
          <code>dist</code>, <code>build</code>, <code>out</code>, <code>coverage</code>,{" "}
          <code>.next</code>, <code>.turbo</code>, <code>.cache</code>, <code>.vercel</code>.
        </li>
      </ul>
      <p>
        Something not working? See <Link href="/docs/troubleshooting">troubleshooting</Link>.
      </p>
    </Doc>
  );
}
