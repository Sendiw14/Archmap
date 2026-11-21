import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { dismissTour, MOCK_ID, summary, waitForRoute } from "./helpers";

/**
 * Evidence capture (spec 10.6, 17.7). Not part of the default run:
 *   SCREENSHOTS=1 pnpm --filter @archmap/web test:e2e screenshots
 * Writes desktop (1440) and mobile (390) PNGs of every route and key states to docs/design/screenshots/.
 */
test.skip(process.env.SCREENSHOTS !== "1", "set SCREENSHOTS=1 to capture");

const OUT = path.resolve(import.meta.dirname, "../../../docs/design/screenshots");
mkdirSync(OUT, { recursive: true });

const ROUTES: [string, string, boolean][] = [
  ["home", "/", true],
  ["demo", "/demo", false],
  ["import", "/import", true],
  ["analysis-graph", "/analyses/demo-archmap", false],
  ["analysis-graph-cycle", "/analyses/demo-circular?cycle=first", false],
  ["analysis-graph-large", "/analyses/demo-synthetic-1000", false],
  ["analysis-insights", "/analyses/demo-archmap/insights", true],
  [
    "analysis-files",
    `/analyses/demo-archmap/files?node=${encodeURIComponent("file:packages/graph-core/src/index.ts")}`,
    true,
  ],
  ["analysis-report", "/analyses/demo-archmap/report", true],
  ["docs", "/docs", true],
  ["docs-getting-started", "/docs/getting-started", true],
  ["docs-cli", "/docs/cli", true],
  ["docs-architecture", "/docs/architecture", true],
  ["docs-analysis-coverage", "/docs/analysis-coverage", true],
  ["docs-troubleshooting", "/docs/troubleshooting", true],
  ["privacy", "/privacy", true],
  ["security", "/security", true],
  ["not-found", "/this-page-does-not-exist", true],
];

const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
] as const;

async function settle(page: Page, route: string) {
  await waitForRoute(page, route);
  await page.waitForTimeout(1200);
}

for (const [vpName, viewport] of VIEWPORTS) {
  test.describe(vpName, () => {
    test.use({ viewport, reducedMotion: "reduce" });
    test.beforeEach(async ({ context, page }) => {
      await dismissTour(context);
      await page.route("**/health/ready", (r) =>
        r.fulfill({ status: 200, contentType: "application/json", body: '{"status":"ok"}' }),
      );
    });

    for (const [name, route, full] of ROUTES) {
      test(`${name}`, async ({ page }) => {
        await page.goto(route);
        await settle(page, route);
        await page.screenshot({ path: path.join(OUT, `${name}-${vpName}.png`), fullPage: full });
      });
    }

    test("state: demo with selection and inspector", async ({ page }) => {
      await page.goto("/demo");
      await settle(page, "/demo");
      if (vpName === "desktop")
        await page
          .getByRole("region", { name: "Dependency graph" })
          .locator(".react-flow__node")
          .filter({ hasText: "index.ts" })
          .first()
          .click();
      else await page.locator("button[data-row]").first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `state-demo-selection-${vpName}.png`) });
    });

    test("state: demo walkthrough open", async ({ page, context }) => {
      await context.clearCookies();
      await page.goto("/demo");
      await settle(page, "/demo");
      await page.getByRole("button", { name: "Walkthrough" }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `state-demo-walkthrough-${vpName}.png`) });
    });

    test("state: list view", async ({ page }) => {
      await page.goto("/analyses/demo-archmap");
      await settle(page, "/analyses/demo-archmap");
      await page.getByRole("button", { name: "List" }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `state-list-view-${vpName}.png`) });
    });

    test("state: import validation error", async ({ page }) => {
      await page.goto("/import");
      await page.getByLabel("GitHub repository").fill("https://gitlab.com/o/r");
      await page.getByRole("button", { name: /Analyze repository/ }).click();
      await page.screenshot({
        path: path.join(OUT, `state-import-error-${vpName}.png`),
        fullPage: true,
      });
    });

    test("state: import service errors (rate limit)", async ({ page }) => {
      await page.route("**/v1/analyses", (r) =>
        r.fulfill({
          status: 429,
          contentType: "application/json",
          body: '{"error":{"code":"rate_limited","message":"x"}}',
          headers: { "retry-after": "1800" },
        }),
      );
      await page.goto("/import");
      await page.getByLabel("GitHub repository").fill("owner/repo");
      await page.getByRole("button", { name: /Analyze repository/ }).click();
      await page.getByRole("alert").filter({ hasText: "Too many analyses" }).waitFor();
      await page.screenshot({
        path: path.join(OUT, `state-import-rate-limited-${vpName}.png`),
        fullPage: true,
      });
    });

    const mocked: [string, number, () => unknown][] = [
      ["in-progress", 200, () => summary("analyzing")],
      [
        "failed",
        200,
        () => summary("failed", { error: { code: "limit_exceeded", message: "too many files" } }),
      ],
      ["cancelled", 200, () => summary("cancelled")],
      ["expired", 410, () => ({ error: { code: "expired", message: "x" } })],
      ["not-found", 404, () => ({ error: { code: "not_found", message: "x" } })],
    ];
    for (const [name, status, body] of mocked) {
      test(`state: analysis ${name}`, async ({ page }) => {
        await page.route(`**/v1/analyses/${MOCK_ID}`, (r) =>
          r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body()) }),
        );
        await page.goto(`/analyses/${MOCK_ID}`);
        await page.getByRole("heading", { level: 1 }).waitFor();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(OUT, `state-analysis-${name}-${vpName}.png`),
          fullPage: true,
        });
      });
    }
  });
}
