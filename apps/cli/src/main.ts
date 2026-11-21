#!/usr/bin/env node
import fs from "node:fs";
import { Command, InvalidArgumentError } from "commander";
import { ANALYZER_VERSION, AnalysisError, analyze, compilerVersion } from "@archmap/analyzer";
import { SCHEMA_VERSION } from "@archmap/graph-schema";
import { toMarkdown } from "./report.ts";

/** Exit codes: 0 ok (incl. limitations), 1 analysis failed, 2 invalid usage. */
export const EXIT = { ok: 0, failed: 1, usage: 2 } as const;

const positiveInt = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new InvalidArgumentError("must be a positive integer");
  return n;
};

export function buildProgram() {
  const program = new Command()
    .name("archmap")
    .description(
      "Deterministic dependency-graph analysis for JavaScript/TypeScript repositories. Runs locally; never uploads or executes code.",
    )
    .version(`archmap ${ANALYZER_VERSION} (schema ${SCHEMA_VERSION}, ${compilerVersion})`)
    .exitOverride()
    .configureOutput({ writeErr: (s) => process.stderr.write(s) });

  program
    .command("analyze")
    .argument("[path]", "repository root", ".")
    .description("analyze a repository and print a JSON graph or Markdown report")
    .option("-f, --format <format>", "json | markdown", "json")
    .option("-o, --output <file>", "write to file instead of stdout")
    .option("-e, --exclude <glob...>", "exclude repository-relative globs (repeatable)")
    .option("--max-files <n>", "maximum source files to analyze", positiveInt, 10_000)
    .option("--max-file-bytes <n>", "skip files larger than this", positiveInt, 2 * 1024 * 1024)
    .option("--reproducible", "omit timestamp for byte-identical output")
    .option("-q, --quiet", "no progress output")
    .action((root: string, o) => {
      if (o.format !== "json" && o.format !== "markdown") {
        process.stderr.write(`error: --format must be "json" or "markdown"\n`);
        process.exitCode = EXIT.usage;
        return;
      }
      const tty = process.stderr.isTTY && !o.quiet;
      let result;
      try {
        result = analyze(root, {
          exclude: o.exclude,
          maxFiles: o.maxFiles,
          maxFileBytes: o.maxFileBytes,
          reproducible: !!o.reproducible,
          onProgress: tty
            ? (_p, d, t) => d % 50 === 0 && process.stderr.write(`\ranalyzing ${d}/${t} files`)
            : undefined,
        });
      } catch (err) {
        process.stderr.write(
          `error: ${err instanceof AnalysisError ? err.message : String(err)}\n`,
        );
        process.exitCode = err instanceof AnalysisError ? EXIT.usage : EXIT.failed;
        return;
      }
      if (tty) process.stderr.write("\r\x1b[K");
      const { graph } = result;
      const body = o.format === "json" ? `${JSON.stringify(graph, null, 2)}\n` : toMarkdown(graph);
      if (o.output) fs.writeFileSync(o.output, body);
      else process.stdout.write(body);
      if (!o.quiet) {
        const m = graph.metadata;
        const cycles = graph.findings.filter((f) => f.category === "runtime-cycle").length;
        const unresolved = graph.edges.filter((e) => e.resolution === "unresolved").length;
        process.stderr.write(
          `${m.status}: ${m.counts.filesAnalyzed} files, ${graph.edges.length} edges, ${cycles} runtime cycle(s), ${unresolved} unresolved, ${graph.diagnostics.length} diagnostic(s)${o.output ? ` -> ${o.output}` : ""}\n`,
        );
      }
      process.exitCode = graph.metadata.status === "failed" ? EXIT.failed : EXIT.ok;
    });

  program
    .command("doctor")
    .description("check the local environment")
    .action(() => {
      const [major, minor] = process.versions.node.split(".").map(Number) as [number, number];
      const nodeOk = major > 22 || (major === 22 && minor >= 18);
      const lines = [
        `${nodeOk ? "ok  " : "FAIL"} node ${process.versions.node} (requires >= 22.18 for type stripping)`,
        `ok   analyzer ${ANALYZER_VERSION}, schema ${SCHEMA_VERSION}`,
        `ok   compiler ${compilerVersion}`,
        `ok   platform ${process.platform}/${process.arch}`,
      ];
      process.stdout.write(`${lines.join("\n")}\n`);
      process.exitCode = nodeOk ? EXIT.ok : EXIT.failed;
    });
  return program;
}

if (import.meta.main) {
  try {
    buildProgram().parse();
  } catch (err) {
    const e = err as { exitCode?: number; code?: string };
    if (e.code === "commander.helpDisplayed" || e.code === "commander.version")
      process.exitCode = EXIT.ok;
    else process.exitCode = EXIT.usage;
  }
}
