import { expect, test, type Route } from "@playwright/test";
import { DEFAULT_LIMITS } from "@archmap/contracts";
import { MOCK_ID, summary } from "./helpers";

const json = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers });
const err = (code: string) => ({ error: { code, message: "server detail" } });

test.describe("import page", () => {
  test.beforeEach(async ({ page }) => {
    // advisory health check: default to healthy so validation tests are quiet
    await page.route("**/health/ready", (route) => json(route, 200, { status: "ok" }));
    await page.goto("/import");
  });

  test("shows guidance, privacy and limits taken from DEFAULT_LIMITS", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Analyze a public GitHub repository",
    );
    await expect(page.getByRole("heading", { name: "What can be analyzed" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
    const limits = page.getByRole("heading", { name: "Limits" }).locator("..").locator("..");
    await expect(limits).toContainText(String(DEFAULT_LIMITS.submissionsPerClientPerHour));
    await expect(limits).toContainText(DEFAULT_LIMITS.maxFiles.toLocaleString("en-US"));
    await expect(limits).toContainText(`${DEFAULT_LIMITS.retentionHours} hours`);
    await expect(page.getByRole("link", { name: "CLI instructions" })).toHaveAttribute(
      "href",
      "/docs/cli",
    );
  });

  test("validates an empty field, a foreign host and a bad ref without calling the API", async ({
    page,
  }) => {
    let posted = false;
    await page.route("**/v1/analyses", (route) => {
      posted = true;
      return json(route, 500, err("internal"));
    });
    const field = page.getByLabel("GitHub repository");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Enter a GitHub repository" }),
    ).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toBeFocused();

    await field.fill("https://gitlab.com/owner/repo");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Only public github.com repositories" }),
    ).toBeVisible();

    await field.fill("owner/repo");
    await page.getByText("Advanced options").click();
    await page.getByLabel(/Branch, tag or commit/).fill("a..b");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "not a valid branch" })).toBeVisible();
    expect(posted).toBe(false);

    // typing clears the error
    await field.fill("owner/rep");
    await expect(field).not.toHaveAttribute("aria-invalid", "true");
  });

  test("submits the parsed request and redirects to the analysis, remembering canManage", async ({
    page,
  }) => {
    let body: unknown;
    await page.route("**/v1/analyses", (route) => {
      body = route.request().postDataJSON();
      return json(route, 202, { analysis: summary("queued"), reused: false, canManage: true });
    });
    await page.route(`**/v1/analyses/${MOCK_ID}`, (route) => json(route, 200, summary("queued")));
    await page.getByLabel("GitHub repository").fill("https://github.com/Mock-Owner/mock-repo");
    await page.getByText("Advanced options").click();
    await page.getByLabel(/Branch, tag or commit/).fill("release/1.0");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(page).toHaveURL(new RegExp(`/analyses/${MOCK_ID}$`));
    expect(body).toEqual({
      repository: "https://github.com/Mock-Owner/mock-repo",
      ref: "release/1.0",
    });
    expect(
      await page.evaluate((id) => sessionStorage.getItem(`archmap.manage.${id}`), MOCK_ID),
    ).toBe("1");
    await expect(page.getByRole("button", { name: "Cancel analysis" })).toBeVisible();
  });

  test("prefills from ?repo= and ?ref=", async ({ page }) => {
    await page.goto("/import?repo=a%2Fb&ref=main");
    await expect(page.getByLabel("GitHub repository")).toHaveValue("a/b");
    await expect(page.getByLabel(/Branch, tag or commit/)).toHaveValue("main");
  });

  const cases: [string, number, string, RegExp, string?][] = [
    ["rate_limited", 429, "rate_limited", /Too many analyses/, "Try again later"],
    ["imports_disabled", 503, "imports_disabled", /Hosted import is paused/, "Use the CLI instead"],
    ["queue_full", 503, "queue_full", /analysis queue is full/, "Try again"],
    ["repository_not_found", 404, "repository_not_found", /Repository not found/],
    [
      "repository_not_public",
      403,
      "repository_not_public",
      /Repository is not public/,
      "Use the CLI instead",
    ],
    ["ref_not_found", 404, "ref_not_found", /Branch, tag or commit not found/],
    ["github_unavailable", 503, "github_unavailable", /GitHub did not respond/, "Try again"],
    ["limit_exceeded", 413, "limit_exceeded", /over the hosted limits/, "Use the CLI instead"],
    ["internal", 500, "internal", /Something went wrong on our side/, "Try again"],
  ];
  for (const [name, status, code, title, action] of cases) {
    test(`${name}: human message and recovery`, async ({ page }) => {
      await page.route("**/v1/analyses", (route) =>
        json(route, status, err(code), status === 429 ? { "retry-after": "1200" } : {}),
      );
      await page.getByLabel("GitHub repository").fill("owner/repo");
      await page.getByRole("button", { name: /Analyze repository/ }).click();
      const alert = page.getByRole("alert").filter({ hasText: title });
      await expect(alert).toBeVisible();
      await expect(alert).not.toContainText("server detail");
      if (action)
        await expect(
          alert.getByRole("link", { name: action }).or(alert.getByRole("button", { name: action })),
        ).toBeVisible();
      if (name === "rate_limited") await expect(alert).toContainText("20 min");
      await expect(page.getByRole("button", { name: /Analyze repository/ })).toBeEnabled();
    });
  }

  test("a network failure is explained", async ({ page }) => {
    await page.route("**/v1/analyses", (route) => route.abort());
    await page.getByLabel("GitHub repository").fill("owner/repo");
    await page.getByRole("button", { name: /Analyze repository/ }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Cannot reach the ARCHMAP service" }),
    ).toBeVisible();
  });

  test("double submit sends one request and shows the submitting state", async ({ page }) => {
    let calls = 0;
    await page.route("**/v1/analyses", async (route) => {
      calls++;
      await new Promise((r) => setTimeout(r, 600));
      return json(route, 429, err("rate_limited"));
    });
    await page.getByLabel("GitHub repository").fill("owner/repo");
    const submit = page.getByRole("button", { name: /Analyze repository/ });
    await submit.click();
    await expect(page.getByRole("button", { name: /Starting analysis/ })).toBeDisabled();
    await page
      .getByLabel("GitHub repository")
      .press("Enter")
      .catch(() => {});
    await expect(page.getByRole("alert").filter({ hasText: "Too many analyses" })).toBeVisible();
    expect(calls).toBe(1);
  });
});

test("warns when the hosted service is unreachable, without blocking the page", async ({
  page,
}) => {
  await page.route("**/health/ready", (route) => route.abort());
  await page.goto("/import");
  await expect(
    page.getByText("The hosted analysis service is not reachable right now"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "demo" }).first()).toBeVisible();
});
