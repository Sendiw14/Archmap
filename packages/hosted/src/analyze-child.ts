/**
 * Runs in a separate Node process with a memory cap, a wall-clock timeout enforced by the parent,
 * and an empty environment (no secrets). Parses source only; never executes repository code.
 * argv: <sourceDir> <outFile> <maxFiles> <maxFileBytes> <repoName> <commit>
 */
import fs from "node:fs";
import { analyze } from "@archmap/analyzer";

const [dir, out, maxFiles, maxFileBytes, name, commit] = process.argv.slice(2);
if (!dir || !out || !maxFiles || !maxFileBytes || !name || !commit) {
  process.stderr.write(
    "usage: analyze-child <dir> <out> <maxFiles> <maxFileBytes> <name> <commit>\n",
  );
  process.exit(2);
}
const { graph } = analyze(dir, {
  maxFiles: Number(maxFiles),
  maxFileBytes: Number(maxFileBytes),
  repository: { name, commit },
});
fs.writeFileSync(out, JSON.stringify(graph));
