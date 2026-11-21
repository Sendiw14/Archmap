import { expect, test } from "@playwright/test";
import {
  ALL_ROUTES,
  dismissTour,
  expectNoSeriousViolations,
  MOCK_ID,
  summary,
  waitForRoute,
} from "./helpers";

test.describe("axe: zero serious or critical violations (WCAG 2.2 A/AA rules)", () => {
  // entrance animations are tested elsewhere; axe must not sample a half-faded element
  test.use({ reducedMotion: "reduce" });
  test.beforeEach(async ({ context, page }) => {
    await dismissTour(context);
    await page.route("**/health/ready", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"status":"ok"}' }),
    );
  });

  for (const route of ALL_ROUTES) {
    test(`route ${route}`, async ({ page }) => {
      await page.goto(route);
      await waitForRoute(page, route);
      await page.waitForTimeout(400);
      await expectNoSeriousViolations(page);
    });
  }

  test("demo with a selection, inspector, list view and open walkthrough", async ({
    page,
    context,
  }) => {
    await page.goto("/demo");
    await waitForRoute(page, "/demo");
    await page.getByRole("treeitem").filter({ hasText: "report.ts" }).first().click();
    await expectNoSeriousViolations(page);
    await page.getByRole("tab", { name: "View" }).click();
    await expectNoSeriousViolations(page);
    await page.getByRole("tab", { name: /Cycles/ }).click();
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: "List" }).click();
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: "Walkthrough" }).click();
    await expectNoSeriousViolations(page);
    void context;
  });

  test("dialogs: help and delete confirmation", async ({ page }) => {
    await page.addInitScript((id) => sessionStorage.setItem(`archmap.manage.${id}`, "1"), MOCK_ID);
    await page.route(`**/v1/analyses/${MOCK_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(summary("completed")),
      }),
    );
    await page.route(`**/v1/analyses/${MOCK_ID}/graph`, async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          (await import("../src/demo-data/circular.json", { with: { type: "json" } })).default,
        ),
      }),
    );
    await page.goto(`/analyses/${MOCK_ID}`);
    await page.getByRole("button", { name: "Help" }).click();
    await expectNoSeriousViolations(page);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Delete" }).click();
    await expectNoSeriousViolations(page);
  });

  test("import page: validation errors, API errors and service warning", async ({ page }) => {
    await page.route("**/v1/analyses", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: '{"error":{"code":"rate_limited","message":"x"}}',
      }),
    );
    await page.goto("/import");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expectNoSeriousViolations(page);
    await page.getByLabel("GitHub repository").fill("owner/repo");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Too many analyses" })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  for (const [name, status, build] of [
    ["in progress", 200, () => summary("analyzing")],
    ["failed", 200, () => summary("failed", { error: { code: "limit_exceeded", message: "big" } })],
    ["cancelled", 200, () => summary("cancelled")],
    ["expired", 410, () => ({ error: { code: "expired", message: "x" } })],
    ["not found", 404, () => ({ error: { code: "not_found", message: "x" } })],
  ] as const) {
    test(`analysis state: ${name}`, async ({ page }) => {
      await page.route(`**/v1/analyses/${MOCK_ID}`, (route) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(build()) }),
      );
      await page.goto(`/analyses/${MOCK_ID}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForTimeout(300);
      await expectNoSeriousViolations(page);
    });
  }

  test("large grouped graph (5,000 modules)", async ({ page }) => {
    await page.goto("/analyses/demo-synthetic-5000");
    await waitForRoute(page, "/analyses/demo-synthetic-5000");
    await expectNoSeriousViolations(page);
  });
});
