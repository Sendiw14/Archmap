/**
 * Builds a self-contained, publishable CLI package in apps/cli/dist:
 * workspace packages are bundled; ts-morph, commander and zod stay runtime dependencies.
 * Usage: node apps/cli/build.ts   then   npm pack apps/cli/dist
 */
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const here = import.meta.dirname;
const root = path.resolve(here, "../..");
const dist = path.join(here, "dist");
const external = ["ts-morph", "commander", "zod"];
const versionOf = (pkg: string, from: string) =>
  JSON.parse(fs.readFileSync(path.join(root, from, "node_modules", pkg, "package.json"), "utf8"))
    .version as string;

fs.rmSync(dist, { recursive: true, force: true });
await build({
  entryPoints: [path.join(here, "src/main.ts")],
  outfile: path.join(dist, "archmap.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external,
  legalComments: "none",
});
fs.chmodSync(path.join(dist, "archmap.mjs"), 0o755);

const cli = JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8"));
fs.writeFileSync(
  path.join(dist, "package.json"),
  `${JSON.stringify(
    {
      name: "archmap",
      version: cli.version,
      description:
        "Deterministic, evidence-backed dependency graphs for JavaScript/TypeScript repositories. Runs locally; never uploads or executes code.",
      license: "MIT",
      type: "module",
      bin: { archmap: "archmap.mjs" },
      files: ["archmap.mjs", "README.md", "LICENSE"],
      engines: { node: ">=22.18.0" },
      dependencies: {
        "ts-morph": versionOf("ts-morph", "packages/compiler-adapter"),
        commander: versionOf("commander", "apps/cli"),
        zod: versionOf("zod", "packages/graph-schema"),
      },
    },
    null,
    2,
  )}\n`,
);
fs.copyFileSync(path.join(root, "README.md"), path.join(dist, "README.md"));
fs.copyFileSync(path.join(root, "LICENSE"), path.join(dist, "LICENSE"));
console.log(
  `built ${path.relative(root, dist)} (${(fs.statSync(path.join(dist, "archmap.mjs")).size / 1024).toFixed(0)} KiB)`,
);
