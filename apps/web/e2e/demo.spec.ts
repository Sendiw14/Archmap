import { expect, test, type Page } from "@playwright/test";
import { dismissTour } from "./helpers";

const graphNodes = (page: Page) =>
  page.getByRole("region", { name: "Dependency graph" }).locator(".react-flow__node");

test.describe("demo exploration", () => {
  test.beforeEach(async ({ context, page }) => {
    await dismissTour(context);
    await page.goto("/demo");
    await expect(graphNodes(page).first()).toBeVisible({ timeout: 30_000 });
  });

  test("identifies demonstration data and its provenance", async ({ page }) => {
    await expect(page.getByText("Demonstration data").first()).toBeVisible();
    await page.getByText("How this data was made").click();
    await expect(page.getByText("pnpm demo:data")).toBeVisible();
  });

  test("selecting a module shows evidence with file:line:column and impact", async ({ page }) => {
    await graphNodes(page).filter({ hasText: "index.ts" }).first().click();
    const inspector = page.getByRole("complementary", { name: "Inspector" });
    await expect(inspector.getByRole("heading", { name: /^Imports \(/ })).toBeVisible();
    await expect(inspector.getByText(/\.ts:\d+:\d+/).first()).toBeVisible();
    await expect(inspector.getByRole("heading", { name: "Potential change impact" })).toBeVisible();
    await expect(
      inspector.getByText(/not mean they will break|does not mean they will break/),
    ).toBeVisible();
    // the selection is announced
    await expect(page.locator("[aria-live=polite]").filter({ hasText: /^Selected / })).toHaveCount(
      1,
    );
  });

  test("selecting from the explorer tree selects in the graph and the inspector", async ({
    page,
  }) => {
    await page.getByRole("treeitem").filter({ hasText: "report.ts" }).first().click();
    await expect(
      page
        .getByRole("complementary", { name: "Inspector" })
        .getByRole("heading", { name: "report.ts" }),
    ).toBeVisible();
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
  });

  test("search highlights matches and Enter selects the first", async ({ page }) => {
    const search = page.getByRole("combobox", { name: /Search modules by path/ });
    await search.fill("graph-core");
    await expect(page.getByText(/\d+ matches?\./)).toBeVisible();
    await search.press("Enter");
    await expect(
      page
        .getByRole("complementary", { name: "Inspector" })
        .getByRole("heading", { level: 3 })
        .first(),
    ).toBeVisible();
  });

  test("cycle investigation: open the circular sample from the walkthrough", async ({ page }) => {
    await page.getByRole("button", { name: "Walkthrough" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Open the circular sample" }).click();
    await expect(
      page
        .getByRole("complementary", { name: "Inspector" })
        .getByRole("heading", { name: /Runtime cycle, 3 modules/ }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("complementary", { name: "Inspector" }).getByText(/import "\.\/b"/),
    ).toBeVisible();
    await expect(page.locator(".am-node[data-role=member]")).toHaveCount(3);
  });

  test("direction filter limits the highlight to imports or importers", async ({ page }) => {
    await page.getByLabel("Sample").selectOption("circular");
    await expect(graphNodes(page).first()).toBeVisible();
    await graphNodes(page).filter({ hasText: "a.ts" }).first().click();
    const both = await page.locator(".am-node[data-role]").count();
    await page.getByRole("tab", { name: "View" }).click();
    await page.getByRole("button", { name: "Imports", exact: true }).click();
    const out = await page.locator(".am-node[data-role]").count();
    await page.getByRole("button", { name: "Imported by", exact: true }).click();
    const inc = await page.locator(".am-node[data-role]").count();
    expect(out).toBeLessThan(both + 1);
    expect(inc).toBeLessThan(both + 1);
    expect(out + inc).toBeGreaterThanOrEqual(both);
  });

  test("reset clears search, selection and filters", async ({ page }) => {
    await page.getByRole("combobox", { name: /Search modules by path/ }).fill("zzz");
    await graphNodes(page).first().click();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByRole("combobox", { name: /Search modules by path/ })).toHaveValue("");
    await expect(
      page.getByRole("complementary", { name: "Inspector" }).getByText(/Select a module/),
    ).toBeVisible();
  });

  test("list view is fully keyboard operable", async ({ page }) => {
    await page.getByRole("button", { name: "List" }).click();
    const rows = page.locator("button[data-row]");
    await expect(rows.first()).toBeVisible();
    await rows.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(rows.last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(rows.first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page
        .getByRole("complementary", { name: "Inspector" })
        .getByRole("heading", { level: 3 })
        .first(),
    ).toBeVisible();
    await expect(rows.first()).toHaveAttribute("aria-current", "true");
  });

  test("explorer tree keyboard: arrows expand, collapse and move", async ({ page }) => {
    const tree = page.getByRole("tree", { name: "Files and packages" });
    const first = tree.getByRole("treeitem").first();
    await first.focus();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowRight");
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowDown");
    await expect(tree.getByRole("treeitem").nth(1)).toBeFocused();
  });

  test("keyboard shortcuts: / focuses search, ? opens help, Esc clears the selection", async ({
    page,
  }) => {
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("/");
    await expect(page.getByRole("combobox", { name: /Search modules by path/ })).toBeFocused();
    await page.getByRole("combobox", { name: /Search modules by path/ }).press("Escape");
    await page.getByRole("treeitem").filter({ hasText: "report.ts" }).first().click();
    await page.getByRole("treeitem").filter({ hasText: "report.ts" }).first().press("Escape");
    await expect(
      page.getByRole("complementary", { name: "Inspector" }).getByText(/Select a module/),
    ).toBeVisible();
  });

  test("panels collapse and full screen toggles", async ({ page }) => {
    await page.getByRole("button", { name: "Hide the explorer panel" }).click();
    await expect(page.getByRole("tree")).toHaveCount(0);
    await page.getByRole("button", { name: "Show the explorer panel" }).click();
    await expect(page.getByRole("tree")).toBeVisible();
    await page.getByRole("button", { name: "Full screen" }).click();
    await expect(page.getByRole("button", { name: "Leave full screen" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
  });

  test("the walkthrough is dismissible and remembers it", async ({ page }) => {
    await page.getByRole("button", { name: "Walkthrough" }).click();
    await expect(page.getByRole("region", { name: "Guided walkthrough" })).toBeVisible();
    await page.getByRole("button", { name: "Dismiss walkthrough" }).click();
    await expect(page.getByRole("region", { name: "Guided walkthrough" })).toHaveCount(0);
  });

  test("offers an import call to action", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Analyze your own repo/ }).first()).toHaveAttribute(
      "href",
      "/import",
    );
  });
});

test("mobile: list view by default, searchable, inspector opens as a dialog", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await dismissTour(ctx);
  const page = await ctx.newPage();
  await page.goto("/demo");
  await expect(page.locator("button[data-row]").first()).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/Search modules by path/).fill("report");
  await page.locator("button[data-row]").first().click();
  const dialog = page.getByRole("dialog", { name: "Inspector" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await ctx.close();
});
