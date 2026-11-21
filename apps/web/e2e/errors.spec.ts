import { expect, test, type Page, type Route } from "@playwright/test";
import { MOCK_ID, summary } from "./helpers";

test("404 page offers ways back", async ({ page }) => {
  const res = await page.goto("/definitely/not/here");
  expect(res?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "This page does not exist" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the demo" })).toBeVisible();
});

test("unknown demo analysis shows the not-found state", async ({ page }) => {
  await page.goto("/analyses/demo-nope");
  await expect(page.getByRole("heading", { level: 1, name: "Analysis not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import a repository" })).toBeVisible();
});

const json = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers });
const err = (code: string, message = "x") => ({ error: { code, message } });

async function mockGet(page: Page, handler: (route: Route, n: number) => unknown) {
  let n = 0;
  await page.route(`**/v1/analyses/${MOCK_ID}`, (route) => handler(route, n++));
}

test.describe("hosted analysis states (API mocked)", () => {
  test("polls through every phase and shows only the phase, never a percentage", async ({
    page,
  }) => {
    const sequence = ["queued", "fetching", "analyzing", "persisting", "failed"];
    await mockGet(page, (route, n) => {
      const status = sequence[Math.min(n, sequence.length - 1)]!;
      return json(
        route,
        200,
        summary(
          status,
          status === "failed" ? { error: { code: "analysis_timeout", message: "timed out" } } : {},
        ),
      );
    });
    await page.goto(`/analyses/${MOCK_ID}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "mock-owner/mock-repo" }),
    ).toBeVisible();
    await expect(page.locator('li[aria-current="step"]')).toContainText("Queued");
    await expect(page.locator("body")).not.toContainText(/\d+\s?%/);
    await expect(page.getByText("Current phase: Fetching")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Current phase: Analyzing")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: /Analysis failed: The analysis took too long/ }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Use the CLI instead" })).toBeVisible();
  });

  test("failed analysis explains the error with a recovery action", async ({ page }) => {
    await mockGet(page, (route) =>
      json(
        route,
        200,
        summary("failed", { error: { code: "repository_not_public", message: "private" } }),
      ),
    );
    await page.goto(`/analyses/${MOCK_ID}`);
    await expect(
      page.getByRole("heading", { level: 1, name: /Repository is not public/ }),
    ).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Analysis failed" })).toContainText(
      "repository_not_public",
    );
  });

  test("cancelled analysis", async ({ page }) => {
    await mockGet(page, (route) => json(route, 200, summary("cancelled")));
    await page.goto(`/analyses/${MOCK_ID}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "This analysis was cancelled" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Analyze again" })).toHaveAttribute(
      "href",
      /\/import\?repo=mock-owner%2Fmock-repo/,
    );
  });

  test("expired (410) and expired status", async ({ page }) => {
    await mockGet(page, (route) => json(route, 410, err("expired")));
    await page.goto(`/analyses/${MOCK_ID}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "This analysis has expired" }),
    ).toBeVisible();
    await expect(page.getByText(/24 hours/)).toBeVisible();
  });

  test("not found (404)", async ({ page }) => {
    await mockGet(page, (route) => json(route, 404, err("not_found")));
    await page.goto(`/analyses/${MOCK_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "Analysis not found" })).toBeVisible();
  });

  test("graph 409 not_ready keeps polling until the graph arrives", async ({ page }) => {
    await mockGet(page, (route) =>
      json(route, 200, summary("completed", { stats: { files: 4, edges: 4, findings: 1 } })),
    );
    let tries = 0;
    await page.route(`**/v1/analyses/${MOCK_ID}/graph`, async (route) => {
      if (tries++ < 2) return json(route, 409, err("not_ready"));
      const graph = (await import("../src/demo-data/circular.json", { with: { type: "json" } }))
        .default;
      return json(route, 200, graph);
    });
    await page.goto(`/analyses/${MOCK_ID}`);
    await expect(
      page.getByRole("region", { name: "Dependency graph" }).locator(".react-flow__node").first(),
    ).toBeVisible({ timeout: 30_000 });
    expect(tries).toBeGreaterThanOrEqual(3);
    await expect(page.getByRole("link", { name: "mock-owner/mock-repo" })).toHaveAttribute(
      "href",
      "https://github.com/mock-owner/mock-repo",
    );
  });

  test("an invalid graph is rejected, not rendered", async ({ page }) => {
    await mockGet(page, (route) => json(route, 200, summary("completed")));
    await page.route(`**/v1/analyses/${MOCK_ID}/graph`, (route) =>
      json(route, 200, { nodes: "nope" }),
    );
    await page.goto(`/analyses/${MOCK_ID}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "The service sent an unexpected response" }),
    ).toBeVisible();
  });

  test("persistent network failure backs off, then stalls with a retry", async ({ page }) => {
    test.setTimeout(120_000);
    let calls = 0;
    await mockGet(page, (route) => {
      calls++;
      return route.abort();
    });
    await page.goto(`/analyses/${MOCK_ID}`);
    // backoff 2 s, 4 s, 8 s, 15 s, then give up after five consecutive failures
    await expect(
      page.getByRole("heading", { level: 1, name: "Cannot reach the ARCHMAP service" }),
    ).toBeVisible({ timeout: 60_000 });
    expect(calls).toBe(5);
    await page.unroute(`**/v1/analyses/${MOCK_ID}`);
    await page.route(`**/v1/analyses/${MOCK_ID}`, (route) =>
      json(route, 200, summary("failed", { error: { code: "internal", message: "x" } })),
    );
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Analysis failed/ })).toBeVisible();
  });

  test("Cancel and Delete appear only for the creating session and handle 401 gracefully", async ({
    page,
  }) => {
    await page.addInitScript((id) => sessionStorage.setItem(`archmap.manage.${id}`, "1"), MOCK_ID);
    await mockGet(page, (route) => json(route, 200, summary("analyzing")));
    await page.route(`**/v1/analyses/${MOCK_ID}/cancel`, (route) =>
      json(route, 401, err("unauthorized")),
    );
    await page.goto(`/analyses/${MOCK_ID}`);
    await page.getByRole("button", { name: "Cancel analysis" }).click();
    await expect(page.getByText(/management session has ended/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel analysis" })).toHaveCount(0);
  });

  test("delete asks for confirmation and returns to import", async ({ page }) => {
    await page.addInitScript((id) => sessionStorage.setItem(`archmap.manage.${id}`, "1"), MOCK_ID);
    await mockGet(page, async (route) => {
      if (route.request().method() === "DELETE") return route.fulfill({ status: 204 });
      return json(route, 200, summary("completed"));
    });
    await page.route(`**/v1/analyses/${MOCK_ID}/graph`, async (route) =>
      json(
        route,
        200,
        (await import("../src/demo-data/circular.json", { with: { type: "json" } })).default,
      ),
    );
    await page.goto(`/analyses/${MOCK_ID}`);
    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete this analysis?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keep it" })).toBeFocused();
    await dialog.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/import$/);
  });
});
