import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ArchmapGraph } from "@archmap/graph-schema";

const MAIN = path.resolve(import.meta.dirname, "main.ts");
const FIX = path.resolve(import.meta.dirname, "../../../fixtures");
const run = (...args: string[]) =>
  spawnSync(process.execPath, [MAIN, ...args], { encoding: "utf8" });

describe("archmap CLI", () => {
  it("prints valid, reproducible JSON", () => {
    const a = run("analyze", path.join(FIX, "circular"), "--reproducible", "-q");
    expect(a.status).toBe(0);
    const g = ArchmapGraph.parse(JSON.parse(a.stdout));
    expect(g.findings.map((f) => f.category)).toEqual(["runtime-cycle"]);
    expect(run("analyze", path.join(FIX, "circular"), "--reproducible", "-q").stdout).toBe(
      a.stdout,
    );
  });
  it("writes markdown to a file", () => {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "archmap-")), "r.md");
    const r = run("analyze", path.join(FIX, "path-alias"), "-f", "markdown", "-o", out);
    expect(r.status).toBe(0);
    const md = fs.readFileSync(out, "utf8");
    expect(md).toContain("## Unresolved imports");
    expect(md).toContain("`@/missing`");
    expect(r.stderr).toContain("completed_with_limitations");
  });
  it("uses exit code 2 for invalid input", () => {
    expect(run("analyze", path.join(FIX, "nope")).status).toBe(2);
    expect(run("analyze", FIX, "--format", "xml").status).toBe(2);
    expect(run("analyze", FIX, "--max-files", "-1").status).toBe(2);
    expect(run("bogus").status).toBe(2);
  });
  it("supports --help, --version, doctor", () => {
    expect(run("--help").status).toBe(0);
    expect(run("--version").stdout).toMatch(/archmap 0\.1\.0/);
    expect(run("doctor").stdout).toContain("compiler typescript@");
  });
});
