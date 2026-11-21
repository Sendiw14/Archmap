// Usage: node tests/performance/bench-analyzer.ts <workdir>
// Generates synthetic repos (100/1000/5000 files, ~5 imports each, some cycles) and records phase timings.
import fs from "node:fs";
import path from "node:path";
import { analyze } from "@archmap/analyzer";

const work = process.argv[2];
if (!work) throw new Error("usage: bench-analyzer.ts <workdir>");
const rows: string[] = [];
for (const n of [100, 1000, 5000]) {
  const dir = path.join(work, `synthetic-${n}`);
  fs.rmSync(dir, { recursive: true, force: true });
  for (let i = 0; i < n; i++) {
    const sub = path.join(dir, "src", `m${i % 20}`);
    fs.mkdirSync(sub, { recursive: true });
    const imports = Array.from({ length: 5 }, (_, k) => (i * 7 + k * 13 + 1) % n)
      .map((j) => `import { v${j} } from "../m${j % 20}/f${j}";`)
      .join("\n");
    fs.writeFileSync(path.join(sub, `f${i}.ts`), `${imports}\nexport const v${i} = ${i};\n`);
  }
  const before = process.memoryUsage().rss;
  const t = performance.now();
  const { graph, timings } = analyze(dir, { reproducible: true });
  const total = performance.now() - t;
  const json = JSON.stringify(graph);
  rows.push(
    `| ${n} | ${graph.edges.length} | ${timings.scan} | ${timings.parse} | ${timings.resolve} | ${timings.algorithms} | ${Math.round(total)} | ${Math.round((process.memoryUsage().rss - before) / 1e6)} | ${(json.length / 1e6).toFixed(1)} |`,
  );
}
console.log(
  "| files | edges | scan ms | parse ms | resolve ms | algorithms ms | total ms | RSS delta MB | JSON MB |",
);
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
console.log(rows.join("\n"));
