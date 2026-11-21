import { expect, test } from "@playwright/test";

/**
 * Real end-to-end against the offline memory API (pnpm --filter @archmap/api dev:memory),
 * which runs the real fetch -> extract -> analyze -> persist pipeline on local fixtures.
 * Skipped when the API is not started (E2E_NO_API=1).
 */
test.describe("@api hosted flow against the memory API", () => {
  test.skip(process.env.E2E_NO_API === "1", "memory API not running");

  test("import -> progress -> workspace -> insights -> report", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/import");
    await page.getByLabel("GitHub repository").fill("archmap-fixtures/circular");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(page).toHaveURL(/\/analyses\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop()!;

    // either the live phase screen or, if the pipeline is fast, the workspace
    await expect(
      page.getByRole("heading", { level: 1, name: "archmap-fixtures/circular" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("region", { name: "Dependency graph" }).locator(".react-flow__node").first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\d+\s?%/);

    // header: short commit, analyzer, share
    await expect(
      page
        .locator("header")
        .getByText(/^[0-9a-f]{7}$/)
        .first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Share" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`/analyses/${id}`);

    // real data through the real pipeline: a runtime cycle with evidence
    await page.getByRole("tab", { name: /Cycles \(1\)/ }).click();
    await page.getByRole("button", { name: /Runtime cycle/ }).click();
    await expect(
      page.getByRole("complementary", { name: "Inspector" }).getByText(/a\.ts:1:1/),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Analysis sections" })
      .getByRole("link", { name: "Insights" })
      .click();
    await expect(page.getByRole("heading", { name: "Runtime cycle, 3 modules" })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Analysis sections" })
      .getByRole("link", { name: "Report" })
      .click();
    const [md] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download Markdown" }).click(),
    ]);
    expect(md.suggestedFilename()).toMatch(/report\.md$/);
    await expect(page.getByText("Source: ARCHMAP service")).toBeVisible();
  });

  test("a completed_with_limitations fixture shows its unresolved imports", async ({ page }) => {
    await page.goto("/import");
    await page.getByLabel("GitHub repository").fill("archmap-fixtures/unresolved");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(page.getByText("Completed with limitations").first()).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByRole("navigation", { name: "Analysis sections" })
      .getByRole("link", { name: "Insights" })
      .click();
    await expect(page.getByRole("heading", { name: /Unresolved imports \([1-9]/ })).toBeVisible();
  });

  test("unknown fixture: repository_not_found with a recovery action", async ({ page }) => {
    await page.goto("/import");
    await page.getByLabel("GitHub repository").fill("archmap-fixtures/does-not-exist");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Repository not found" })).toBeVisible();
    await expect(page.getByLabel("GitHub repository")).toHaveAttribute("aria-invalid", "true");
  });

  test("the creator can delete an analysis; the link then stops working", async ({ page }) => {
    await page.goto("/import");
    await page.getByLabel("GitHub repository").fill("archmap-fixtures/monorepo");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(
      page.getByRole("region", { name: "Dependency graph" }).locator(".react-flow__node").first(),
    ).toBeVisible({ timeout: 30_000 });
    const url = page.url();
    const del = page.getByRole("button", { name: "Delete" });
    // a reused result is not manageable by a new requester: only assert the delete path when offered
    test.skip((await del.count()) === 0, "result was reused, so this session cannot manage it");
    await del.click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/import$/);
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: "Analysis not found" })).toBeVisible();
  });

  test("a stranger without the cookie cannot delete (401 from the real API)", async ({
    browser,
    page,
    request,
  }) => {
    await page.goto("/import");
    await page.getByLabel("GitHub repository").fill("archmap-fixtures/esm");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(page).toHaveURL(/\/analyses\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop()!;
    const fresh = await browser.newContext();
    const res = await fresh.request.delete(`${new URL(page.url()).origin}/v1/analyses/${id}`, {
      headers: { origin: new URL(page.url()).origin },
    });
    expect([401, 403]).toContain(res.status());
    await fresh.close();
    void request;
  });
});
