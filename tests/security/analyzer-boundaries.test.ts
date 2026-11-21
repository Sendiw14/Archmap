import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { analyze } from "@archmap/analyzer";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "archmap-sec-"));
const outside = fs.mkdtempSync(path.join(os.tmpdir(), "archmap-outside-"));
const repo = path.join(tmp, "repo");
fs.mkdirSync(path.join(repo, "src"), { recursive: true });
fs.writeFileSync(path.join(outside, "secret.ts"), "export const secret = 1;");
fs.writeFileSync(path.join(outside, "tsconfig.json"), "{}");
fs.writeFileSync(
  path.join(repo, "src/main.ts"),
  [
    `import "../../../../../../../../etc/passwd";`,
    `import ${JSON.stringify(`${outside}/secret`)};`,
    `import "../outside/secret";`,
    `import "./big";`,
    `import "C:\\\\Windows\\\\system32\\\\x";`,
    `import "D:/data/secret";`,
    `import "\\\\\\\\server\\\\share\\\\x";`,
  ].join("\n"),
);
fs.symlinkSync(outside, path.join(repo, "outside"), "junction"); // junction: works unprivileged on Windows
fs.writeFileSync(path.join(repo, "src/big.ts"), "x".repeat(4096));
fs.writeFileSync(
  path.join(repo, "tsconfig.json"),
  JSON.stringify({ extends: `${outside}/tsconfig.json` }),
);
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

describe("analyzer trust boundaries", () => {
  const { graph } = analyze(repo, { reproducible: true, maxFileBytes: 1024 });

  it("never resolves targets outside the repository root", () => {
    for (const n of graph.nodes)
      expect(n.path.startsWith("..") || n.path.startsWith("/")).toBe(false);
    expect(graph.edges.filter((e) => e.resolution === "unresolved")).toHaveLength(7);
    expect(graph.nodes.filter((n) => n.kind === "external")).toEqual([]);
  });
  it("does not follow symlinks", () => {
    expect(
      graph.diagnostics.some((d) => d.code === "symlink-skipped" && d.file === "outside"),
    ).toBe(true);
    expect(graph.nodes.some((n) => n.path.includes("secret"))).toBe(false);
  });
  it("skips oversized files with a diagnostic", () => {
    expect(
      graph.diagnostics.some((d) => d.code === "file-too-large" && d.file === "src/big.ts"),
    ).toBe(true);
    expect(graph.metadata.status).toBe("completed_with_limitations");
  });
  it("does not read tsconfig extends outside the root", () => {
    expect(graph.diagnostics.some((d) => d.code === "config-error")).toBe(true);
  });
  it("enforces the file limit", () => {
    const r = analyze(path.resolve(import.meta.dirname, "../../fixtures/esm"), { maxFiles: 2 });
    expect(r.graph.metadata.counts.filesAnalyzed).toBe(2);
    expect(r.graph.diagnostics.some((d) => d.code === "file-limit")).toBe(true);
  });
});
