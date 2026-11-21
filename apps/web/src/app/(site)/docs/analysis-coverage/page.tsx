import type { Metadata } from "next";
import Link from "next/link";
import { Doc, Table } from "../../../../components/docs/doc";

export const metadata: Metadata = {
  title: "Analysis coverage",
  description:
    "Which import constructs ARCHMAP understands, which it reports as unsupported, and what it never does.",
};

const c = (s: string) => <code key={s}>{s}</code>;
const yes = "Yes";

export default function Coverage() {
  return (
    <Doc
      path="/docs/analysis-coverage"
      title="Analysis coverage"
      lead="A precise list of what the analyzer understands. Anything outside it is reported as a diagnostic or an unresolved import, never guessed."
    >
      <h2 id="matrix">Construct matrix</h2>
      <Table
        caption="Supported and unsupported constructs"
        head={["Construct", "Supported", "Recorded as"]}
        rows={[
          [
            <>
              <code>import x from</code>, named, namespace, side-effect imports
            </>,
            yes,
            "import, runtime",
          ],
          [
            <>
              A <code>.js</code> specifier that resolves to a <code>.ts</code> file
            </>,
            yes,
            "import",
          ],
          [<>JSON imports</>, yes, "import to a json node"],
          [
            <>
              <code>export * from</code>, <code>export {"{ x }"} from</code>,{" "}
              <code>export * as ns from</code>
            </>,
            yes,
            "export, runtime",
          ],
          [
            <>
              <code>import type</code>, all-type named imports, <code>export type {"{}"} from</code>
            </>,
            yes,
            "type-only",
          ],
          [c('typeof import("x")'), yes, "import-type, type-only"],
          [
            <>
              <code>require(&quot;x&quot;)</code> with a literal or a template without substitutions
            </>,
            yes,
            "require, runtime",
          ],
          [c('import x = require("x")'), yes, "require"],
          [
            <>
              <code>import(&quot;x&quot;)</code> with a literal
            </>,
            yes,
            "dynamic-import, runtime",
          ],
          [
            <>
              <code>require(expr)</code>, <code>import(expr)</code>
            </>,
            <>
              No: diagnostic <code>unsupported-expression</code>
            </>,
            "counted in coverage",
          ],
          [
            <>
              tsconfig <code>paths</code>, <code>baseUrl</code>, relative <code>extends</code>
            </>,
            yes,
            "resolved edges",
          ],
          [
            <>
              <code>extends</code> from a package in <code>node_modules</code>
            </>,
            <>
              No: diagnostic <code>config-error</code>
            </>,
            "diagnostic",
          ],
          [
            <>
              package.json <code>exports</code> and <code>imports</code>
            </>,
            "Yes, with TypeScript semantics",
            "resolved edges",
          ],
          [
            <>
              Workspace packages by <code>name</code>
            </>,
            "Yes, including source-entry fallback",
            "resolved edges",
          ],
          [<>Project references</>, "Yes, nearest config per file", "resolved edges"],
          [<>Case-mismatched specifiers</>, "Unresolved on every operating system", "unresolved"],
          [
            <>Files with syntax errors</>,
            "Partial: references from the recoverable tree",
            <>
              diagnostic <code>parse-error</code>
            </>,
          ],
          [
            <>Symbolic links</>,
            <>Not followed</>,
            <>
              diagnostic <code>symlink-skipped</code>
            </>,
          ],
          [
            <>
              Vue, Svelte and Astro single-file components, CSS and asset imports, webpack aliases,
              framework file conventions
            </>,
            "No",
            "not analyzed",
          ],
          [
            <>Symbol level: which names are imported or exported</>,
            "No: file level only in version 1",
            "not extracted",
          ],
        ]}
      />

      <h2 id="reading">How to read the gaps</h2>
      <ul>
        <li>
          <strong>Unresolved</strong> means the analyzer found an import statement and could not map
          it to a file or package. It is listed with its line, never dropped. The most common causes
          are in <Link href="/docs/troubleshooting#unresolved">troubleshooting</Link>.
        </li>
        <li>
          <strong>Unsupported expression</strong> means the specifier is computed at runtime. The
          edge cannot exist in a static graph.
        </li>
        <li>
          <strong>Not analyzed</strong> file types simply do not appear. If most of your code is Vue
          or Svelte, the graph will be incomplete, and that is a limitation of version 1.
        </li>
      </ul>

      <h2 id="never">What the analyzer never does</h2>
      <ul>
        <li>Execute repository code, configuration, scripts, plugins or install hooks.</li>
        <li>
          Read outside the repository root, including through <code>../</code>, absolute specifiers,
          symlinks or <code>tsconfig</code> <code>extends</code>.
        </li>
        <li>Type-check your code. Parsing is syntax-only.</li>
        <li>Infer dependencies from naming, folder layout or framework magic.</li>
      </ul>

      <h2 id="impact">What &quot;impact&quot; means</h2>
      <p>
        Potential change impact is the set of modules that import a module directly or through
        others. It is static reachability over the graph. It does not mean those modules will break,
        need edits or are affected at runtime.
      </p>

      <h2 id="limits">Limits</h2>
      <p>
        The CLI analyzes at most 10,000 files and skips files over 2 MiB by default; both are
        adjustable with <code>--max-files</code> and <code>--max-file-bytes</code>. Hosted analyses
        have fixed limits listed on the <Link href="/import">import page</Link>.
      </p>
    </Doc>
  );
}
