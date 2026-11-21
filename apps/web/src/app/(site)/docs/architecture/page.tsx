import type { Metadata } from "next";
import Link from "next/link";
import { API_VERSION, DEFAULT_LIMITS, ErrorCode, JobStatus, TRANSITIONS } from "@archmap/contracts";
import { RULES } from "@archmap/graph-core";
import { SCHEMA_VERSION } from "@archmap/graph-schema";
import { CodeBlock } from "../../../../components/docs/code-block";
import { Doc, Table } from "../../../../components/docs/doc";
import { formatCount, formatDuration, formatHours, formatMiB } from "../../../../lib/format";

export const metadata: Metadata = {
  title: "Architecture",
  description: "The ARCHMAP pipeline, graph schema, algorithms and hosted API contract.",
};

const c = (s: string) => <code key={s}>{s}</code>;
const L = DEFAULT_LIMITS;

export default function Architecture() {
  return (
    <Doc
      path="/docs/architecture"
      title="Architecture"
      lead="How a repository becomes a graph, what the graph contains, how the findings are computed and how the hosted API fits around it."
    >
      <h2 id="pipeline">The pipeline</h2>
      <p>
        The analyzer is a pure function from a directory to a graph. Five stages, each
        deterministic:
      </p>
      <ol>
        <li>
          <strong>Scan.</strong> A root-confined walk lists source files under budgets (file count,
          file size). Symbolic links are not followed and nothing outside the root is read.
        </li>
        <li>
          <strong>Extract.</strong> Each file is parsed syntax-only, with no type checking, and
          every module reference is recorded with its position.
        </li>
        <li>
          <strong>Resolve.</strong> Specifiers are resolved with TypeScript&apos;s own module
          resolution over an in-memory view of the repository: nearest <code>tsconfig</code>,{" "}
          <code>paths</code>, package <code>exports</code>, workspace packages and project
          references.
        </li>
        <li>
          <strong>Build the graph.</strong> Nodes and edges are created and sorted. One edge per
          import statement.
        </li>
        <li>
          <strong>Compute findings, then serialize.</strong> Cycles, hotspots and unresolved imports
          are derived from the graph, then written as JSON or Markdown.
        </li>
      </ol>
      <h3>Packages</h3>
      <ul>
        <li>
          <code>graph-schema</code>: the Zod contract for the graph. Bumping it bumps{" "}
          <code>SCHEMA_VERSION</code> (currently {SCHEMA_VERSION}).
        </li>
        <li>
          <code>graph-core</code>: pure algorithms (cycles, impact, coupling, package aggregation)
          and the Markdown renderer. Browser-safe, so the web app runs the same code as the CLI.
        </li>
        <li>
          <code>compiler-adapter</code>: the only module that touches the TypeScript API.{" "}
          <code>analyzer</code> orchestrates the pipeline.
        </li>
        <li>
          <code>contracts</code>: the hosted API contract shared by API, worker and web.
        </li>
      </ul>
      <h3>Invariants</h3>
      <ul>
        <li>
          Edge direction is <strong>importing module → imported module</strong> in the engine, the
          API and the UI.
        </li>
        <li>
          The analyzer never reads outside the repository root, never follows symlinks and never
          executes repository code.
        </li>
        <li>Output ids and ordering are deterministic.</li>
      </ul>

      <h2 id="schema">Graph schema reference (version {SCHEMA_VERSION})</h2>
      <p>
        The JSON the CLI writes and the hosted API serves at <code>GET /v1/analyses/:id/graph</code>
        . The top level has six keys: <code>metadata</code>, <code>nodes</code>, <code>edges</code>,{" "}
        <code>findings</code>, <code>diagnostics</code>, <code>coverage</code>.
      </p>
      <h3>metadata</h3>
      <Table
        caption="Fields of metadata"
        head={["Field", "Type", "Meaning"]}
        rows={[
          [
            c("analysisId"),
            "string",
            "Hash of repository, commit, versions, config hash, nodes and edges.",
          ],
          [c("schemaVersion"), "string", "Version of this schema."],
          [c("analyzerVersion"), "string", "Analyzer that produced the graph."],
          [
            c("compilerVersion"),
            "string",
            "TypeScript version used for resolution, such as typescript@6.0.2.",
          ],
          [
            c("repository"),
            "{ name, commit }",
            "Repository name; commit SHA or null when not a git checkout.",
          ],
          [c("configHash"), "string", "Hash of the analysis options."],
          [c("status"), "enum", "completed, completed_with_limitations or failed."],
          [c("generatedAt"), "string | null", "ISO timestamp; null in reproducible mode."],
          [c("counts"), "object", "filesDiscovered, filesAnalyzed, filesExcluded, filesSkipped."],
        ]}
      />
      <h3>nodes[]</h3>
      <Table
        caption="Fields of a node"
        head={["Field", "Type", "Meaning"]}
        rows={[
          [c("id"), "string", "file:<path>, external:<package> or builtin:node:<name>."],
          [c("kind"), "enum", "file, external or builtin."],
          [
            c("path"),
            "string",
            "Repository-relative POSIX path for files; package name for externals and built-ins.",
          ],
          [c("displayName"), "string", "Short label for display."],
          [c("package"), "string | null", "Owning workspace package, if any."],
          [c("language"), "enum | null", "ts, tsx, mts, cts, dts, js, jsx, mjs, cjs or json."],
        ]}
      />
      <h3>edges[]</h3>
      <Table
        caption="Fields of an edge"
        head={["Field", "Type", "Meaning"]}
        rows={[
          [
            c("id"),
            "string",
            "<source>|<kind>|<specifier>|<line>:<column>. One edge per statement.",
          ],
          [c("source"), "string", "Node id of the importing module."],
          [c("target"), "string | null", "Node id of the imported module; null when unresolved."],
          [c("specifier"), "string", "The string in the import, such as ./b."],
          [c("importKind"), "enum", "import, export, require, dynamic-import or import-type."],
          [c("dependencyClass"), "enum", "runtime, or type-only (erased at runtime)."],
          [c("resolution"), "enum", "resolved, external or unresolved."],
          [
            c("evidence"),
            "object",
            "file, line, column and text (the statement, at most 160 characters).",
          ],
          [c("diagnostic"), "string?", "Why resolution failed, when it did."],
        ]}
      />
      <h3>findings[]</h3>
      <Table
        caption="Fields of a finding"
        head={["Field", "Type", "Meaning"]}
        rows={[
          [c("id"), "string", "Stable hash of category and members."],
          [c("category"), "enum", "runtime-cycle, type-cycle, hotspot or unresolved."],
          [c("severity"), "enum", "error, warning or info."],
          [c("nodes"), "string[]", "Node ids involved, sorted."],
          [c("evidence"), "string[]", "Edge ids that support the finding."],
          [c("explanation"), "string", "Human-readable sentence."],
          [c("rule"), "string", "Versioned rule that produced it."],
        ]}
      />
      <h3>diagnostics[] and coverage</h3>
      <Table
        caption="Diagnostics and coverage"
        head={["Field", "Meaning"]}
        rows={[
          [
            c("diagnostics[].code / severity / message"),
            "Something the analyzer could not handle or skipped, with a location or file when known.",
          ],
          [c("coverage.supportedConstructs"), "The constructs this run understood."],
          [
            c("coverage.importKinds / resolutions"),
            "Counts of edges by importKind and by resolution.",
          ],
          [
            c("coverage.unsupportedExpressions"),
            "Computed require/import expressions that were recorded but not followed.",
          ],
          [c("coverage.filesWithParseErrors"), "Files where the parser reported syntax errors."],
        ]}
      />
      <p>
        A <code>completed_with_limitations</code> status means at least one edge is unresolved or at
        least one warning, error or unsupported expression was recorded.
      </p>

      <h2 id="algorithms">Algorithms</h2>
      <h3>Cycles ({RULES.cycle})</h3>
      <p>
        Strongly connected components via an iterative Tarjan algorithm (no recursion limit, tested
        on 50,000 nodes). A component is a cycle if it has more than one module or one module with a
        self-import. A <strong>runtime cycle</strong> uses runtime edges only. A{" "}
        <strong>type-only cycle</strong> appears only when type-only edges are included. Members and
        ordering are sorted for stability.
      </p>
      <h3>Hotspots ({RULES.hotspot})</h3>
      <p>
        For every file, coupling = fan-in + fan-out, counted as distinct files and excluding
        self-imports. A file is a hotspot when its coupling is at least the larger of 8 and ⌈mean +
        2 × standard deviation⌉ over all files. The threshold is quoted in each finding.
      </p>
      <h3>Unresolved imports ({RULES.unresolved})</h3>
      <p>
        One finding per file that contains at least one import the resolver could not map. Each edge
        keeps its evidence and diagnostic.
      </p>
      <h3>Potential change impact</h3>
      <p>
        A breadth-first search along reverse edges from a module: every module that imports it
        directly or through others, with the shortest chain. This is <em>static reachability</em>.
        It does not say those modules will break or need edits.
      </p>
      <h3>Dependency paths and package aggregation</h3>
      <p>
        The shortest import path between two modules is a breadth-first search along edge direction.
        Package relationships sum file-level edges whose endpoints belong to different workspace
        packages.
      </p>
      <h3>Large-graph aggregation in the workspace</h3>
      <p>
        Above 400 files the workspace starts grouped by folder (or package). A collapsed group
        stands in for its members, and edges between groups are the sum of the edges between their
        members, so nothing is lost. Expanding a group replaces it with its children and re-runs the
        layout in a Web Worker.
      </p>

      <h2 id="hosted-api">Hosted API ({API_VERSION})</h2>
      <p>
        Hosted import analyzes public GitHub repositories in an isolated worker. The web app talks
        only to its own origin; <code>/v1</code> and <code>/health</code> are proxied to the API.
        Bodies are validated with the Zod schemas in <code>@archmap/contracts</code>.
      </p>
      <Table
        caption="Hosted API endpoints"
        head={["Endpoint", "Purpose"]}
        rows={[
          [
            c("POST /v1/analyses"),
            <>
              Start an analysis. Body:{" "}
              <code>{`{ "repository": "owner/repo", "ref"?: "branch|tag|sha" }`}</code>. Returns the
              analysis, whether it was reused, and whether this client may manage it.
            </>,
          ],
          [c("GET /v1/analyses/:id"), "Status and metadata of an analysis."],
          [c("GET /v1/analyses/:id/graph"), "The graph (409 not_ready until a result exists)."],
          [c("GET /v1/analyses/:id/findings"), "The findings array."],
          [c("GET /v1/analyses/:id/report?format=markdown"), "The Markdown report."],
          [
            c("POST /v1/analyses/:id/cancel"),
            "Cancel a running analysis (needs the management capability).",
          ],
          [c("DELETE /v1/analyses/:id"), "Delete an analysis (needs the management capability)."],
          [c("GET /health/live, /health/ready"), "Liveness and readiness."],
        ]}
      />
      <h3>Job states</h3>
      <p>
        An analysis is in exactly one of:{" "}
        {JobStatus.options.map((s, i) => (
          <span key={s}>
            {i > 0 && ", "}
            <code>{s}</code>
          </span>
        ))}
        . ARCHMAP does not measure completion, so the UI shows the current phase and never a
        percentage. Allowed transitions:
      </p>
      <Table
        caption="Permitted job state transitions"
        head={["From", "To"]}
        rows={JobStatus.options.map((s) => [
          c(s),
          TRANSITIONS[s].length
            ? TRANSITIONS[s].map((t, i) => (
                <span key={t}>
                  {i > 0 && ", "}
                  <code>{t}</code>
                </span>
              ))
            : "terminal",
        ])}
      />
      <h3>Errors</h3>
      <p>
        Failures use <code>{`{ "error": { "code", "message" } }`}</code>. The codes are:{" "}
        {ErrorCode.options.map((s, i) => (
          <span key={s}>
            {i > 0 && ", "}
            <code>{s}</code>
          </span>
        ))}
        . Each is explained, with a recovery step, in{" "}
        <Link href="/docs/troubleshooting#hosted-errors">troubleshooting</Link>.
      </p>
      <h3>Managing an analysis</h3>
      <p>
        Viewing needs only the link. Cancelling and deleting need a random management capability
        issued to the browser that created the analysis, held in an <code>HttpOnly</code>,{" "}
        <code>SameSite=Strict</code> cookie scoped to that analysis. It is never in a URL and the
        server stores only a hash. State-changing requests are checked against the page&apos;s
        origin. If you clear cookies or switch browsers you lose the ability to delete early; the
        result still expires.
      </p>
      <h3>Default limits</h3>
      <p>Starting policy, not measured capacity.</p>
      <Table
        caption="Hosted default limits"
        head={["Limit", "Value"]}
        rows={[
          ["Compressed archive", formatMiB(L.maxArchiveBytes)],
          ["Extracted source", formatMiB(L.maxExtractedBytes)],
          ["Source files", formatCount(L.maxFiles)],
          ["Single file", formatMiB(L.maxFileBytes)],
          ["Archive entries", formatCount(L.maxArchiveEntries)],
          ["Analysis time", formatDuration(L.analysisTimeoutMs)],
          ["Worker memory", `about ${formatMiB(L.workerMemoryMb * 1024 * 1024)}`],
          ["Worker concurrency", `${L.workerConcurrency} jobs`],
          ["New analyses per client per hour", formatCount(L.submissionsPerClientPerHour)],
          ["Queue depth", formatCount(L.maxQueueDepth)],
          ["Graph size", formatMiB(L.maxGraphBytes)],
          ["Result retention", formatHours(L.retentionHours)],
        ]}
      />
      <h3>Cache identity</h3>
      <p>
        A result is reused only for the same repository, commit SHA, analyzer version, schema
        version and configuration hash. A branch name alone is never a cache key.
      </p>

      <h2 id="decisions">Decisions</h2>
      <p>
        Architecture decisions are recorded as ADRs in the repository: source-first monorepo, the
        compiler adapter, root-confined resolution, and the graph contract and finding rules.
      </p>
      <CodeBlock label="ADR files">{`docs/adr/0001-monorepo-source-first.md
docs/adr/0002-compiler-adapter.md
docs/adr/0003-root-confined-resolution.md
docs/adr/0004-graph-contract-and-findings.md`}</CodeBlock>
    </Doc>
  );
}
