import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { dismissTour } from "./helpers";

/**
 * Graph benchmarks (spec 13.2). Not part of the default run:
 *   PERF=1 pnpm --filter @archmap/web test:e2e perf
 * Results go to apps/web/test-results/perf.json; docs/benchmarks/web.md records the method and numbers.
 */
test.skip(process.env.PERF !== "1", "set PERF=1 to benchmark");

const results: Record<string, unknown> = {};
const pct = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(xs.length * p) - 1)]!;
const round = (n: number) => Math.round(n * 10) / 10;

test.afterAll(() => {
  const dir = path.resolve(import.meta.dirname, "../test-results");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "perf.json"), JSON.stringify(results, null, 2));
});

test.beforeEach(async ({ context }) => dismissTour(context));

test("indexed search on the 1,000-module graph, input to rendered result (p95 <= 150 ms)", async ({
  page,
  browser,
}) => {
  await page.goto("/analyses/demo-synthetic-1000");
  await page
    .getByRole("region", { name: "Dependency graph" })
    .locator(".react-flow__node")
    .first()
    .waitFor({ timeout: 60_000 });
  // warm: first keystrokes JIT the code, so "cold" and "warm" are both recorded
  const samples = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const frame = () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const queries = [
      "m",
      "mo",
      "mod",
      "modu",
      "module",
      "module-0",
      "module-01",
      "module-012",
      "module-0123",
      "pkg-03",
      "feature-07",
      "src/feature",
      "0999",
      "synth",
      "ext",
      "zzz",
      "pkg-01/src",
      "node:fs",
      "packages",
      "module-05",
    ];
    const out: { q: string; ms: number }[] = [];
    for (let round = 0; round < 3; round++)
      for (const q of queries) {
        const t0 = performance.now();
        set.call(input, q);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await frame();
        out.push({ q, ms: performance.now() - t0 });
        set.call(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await frame();
      }
    return out;
  });
  const ms = samples.map((s) => s.ms);
  const warm = samples.slice(queries20()).map((s) => s.ms);
  results.search1000 = {
    samples: ms.length,
    coldFirstQueryMs: round(ms[0]!),
    p50: round(pct(warm, 0.5)),
    p95: round(pct(warm, 0.95)),
    max: round(Math.max(...warm)),
    p95AllSamples: round(pct(ms, 0.95)),
    method:
      "set input value, dispatch input event, wait two animation frames (React commit and paint) in a production build, graph view with 1,000 modules grouped",
    device: {
      cpu: os.cpus()[0]?.model,
      cores: os.cpus().length,
      memGB: Math.round(os.totalmem() / 2 ** 30),
      platform: `${os.platform()} ${os.release()}`,
      node: process.version,
      browser: `Chromium ${browser.version()}`,
    },
  };
  expect(pct(warm, 0.95)).toBeLessThanOrEqual(150);
});

function queries20() {
  return 20; // the first pass over the 20 queries is warm-up
}

for (const files of [1000, 5000]) {
  test(`grouped rendering at ${files} modules`, async ({ page }) => {
    const t0 = Date.now();
    await page.goto(`/analyses/demo-synthetic-${files}`);
    const node = page
      .getByRole("region", { name: "Dependency graph" })
      .locator(".react-flow__node")
      .first();
    await node.waitFor({ timeout: 120_000 });
    const firstGraphMs = Date.now() - t0;
    const info = await page.getByText(/modules drawn as [\d,]+ items/).textContent();
    const layoutText = await page.getByText(/ELK \w+ layout/).textContent();
    const heap = async () =>
      page.evaluate(
        () =>
          (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
            ?.usedJSHeapSize ?? 0,
      );
    const heapBefore = await heap();

    // expand one group: time until the new layout is on screen
    const nodesBefore = await page.locator(".react-flow__node").count();
    const infoBefore = info;
    const t1 = Date.now();
    const group = page.locator(".react-flow__node").filter({ hasText: "click to expand" }).first();
    await group.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/modules drawn as [\d,]+ items/)).not.toHaveText(infoBefore!, {
      timeout: 60_000,
    });
    await expect(page.getByText(/ELK \w+ layout/)).toBeVisible();
    await page.waitForFunction(
      (n) => document.querySelectorAll(".react-flow__node").length !== n,
      nodesBefore,
      { timeout: 60_000 },
    );
    const expandMs = Date.now() - t1;
    const layoutAfter = await page.getByText(/ELK \w+ layout/).textContent();

    // interaction: select a visible module and wait for the inspector
    const t2 = Date.now();
    await page
      .locator(".react-flow__node")
      .filter({ hasNotText: "click to expand" })
      .first()
      .click();
    await page
      .getByRole("complementary", { name: "Inspector" })
      .getByRole("heading", { level: 3 })
      .first()
      .waitFor();
    const selectMs = Date.now() - t2;

    // list view of every module (paged)
    const t3 = Date.now();
    await page.getByRole("button", { name: "List" }).click();
    await page.locator("button[data-row]").first().waitFor();
    const listMs = Date.now() - t3;

    results[`grouped${files}`] = {
      pageLoadToFirstGraphMs: firstGraphMs,
      initialItems: info,
      initialLayout: layoutText,
      expandGroupMs: expandMs,
      layoutAfterExpand: layoutAfter,
      selectModuleToInspectorMs: selectMs,
      listViewMs: listMs,
      jsHeapMB: round((await heap()) / 2 ** 20),
      jsHeapBeforeExpandMB: round(heapBefore / 2 ** 20),
    };
    expect(firstGraphMs).toBeLessThan(60_000);
  });
}
