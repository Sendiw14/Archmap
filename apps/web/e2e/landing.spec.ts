import { expect, test } from "@playwright/test";
import { dismissTour } from "./helpers";

test.describe("landing", () => {
  test("hero states the value and leads to the demo", async ({ page, context }) => {
    await dismissTour(context);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "See the architecture behind your code.",
    );
    await page.getByRole("link", { name: "Explore the live demo" }).first().click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText("Demonstration data").first()).toBeVisible();
  });

  test("has all fifteen sections from the spec", async ({ page }) => {
    await page.goto("/");
    // 1 navigation and 15 footer are landmarks; 2-14 are headed sections
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    for (const name of [
      /See the architecture behind your code/,
      /nobody draws it/,
      /Four deterministic steps/,
      /A workspace for understanding/,
      /One import statement becomes one edge/,
      /Pick a module/,
      /Find the loops/,
      /Runs on your machine/,
      /Clear about where your code goes/,
      /This is the real workspace, on real data/,
      /Plain answers/,
      /Look at your own architecture/,
    ])
      await expect(page.getByRole("heading", { name }), String(name)).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toBeVisible();
    // the interactive preview is real graph data, not a placeholder
    await expect(
      page.getByRole("group", { name: /Dependency graph of ARCHMAP's own source files/ }),
    ).toBeVisible();
  });

  test("hero graph preview is interactive and reports real counts", async ({ page }) => {
    await page.goto("/");
    const graph = page.getByRole("group", {
      name: /Dependency graph of ARCHMAP's own source files/,
    });
    const nodes = graph.getByRole("button");
    expect(await nodes.count()).toBeGreaterThan(5);
    const status = page.locator("figcaption");
    await nodes.nth(1).click();
    await expect(status).toContainText(/imports \d+ modules? and is imported by \d+ modules?/);
    await nodes.nth(1).press("Enter");
    await expect(status).toContainText("Select a module");
  });

  test("every call to action leads somewhere real", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page
      .locator("main a[href]")
      .evaluateAll((as) => [
        ...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!)),
      ]);
    expect(hrefs.length).toBeGreaterThan(8);
    for (const href of hrefs.filter((h) => h.startsWith("/"))) {
      const res = await request.get(href.split("#")[0]!);
      expect(res.status(), href).toBeLessThan(400);
    }
  });

  test("content stays visible without JavaScript", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Plain answers/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Four deterministic steps/ })).toBeVisible();
    // the graph is server-rendered SVG, real nodes included
    await expect(page.locator("svg text").filter({ hasText: "index.ts" }).first()).toBeAttached();
    await expect(page.getByText("What does it understand, and what does it miss?")).toBeVisible();
    for (const h of await page.getByRole("heading", { level: 2 }).all())
      expect(await h.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await ctx.close();
  });

  test("scroll reveals never leave content hidden, and reduced motion skips them", async ({
    browser,
  }) => {
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      const ctx = await browser.newContext({
        reducedMotion,
        viewport: { width: 1280, height: 800 },
      });
      const page = await ctx.newPage();
      await page.goto("/");
      if (reducedMotion === "reduce") {
        // nothing is ever put in a hidden pose
        const hidden = await page
          .locator("main section h2")
          .evaluateAll(
            (els) =>
              els.filter(
                (e) => getComputedStyle(e.closest("li, div, section") ?? e).opacity === "0",
              ).length,
          );
        expect(hidden).toBe(0);
      }
      for (let y = 0; y < 12_000; y += 700) {
        await page.mouse.wheel(0, 700);
        await page.waitForTimeout(40);
      }
      await page.waitForTimeout(900);
      const stuck = await page.evaluate(
        () =>
          [...document.querySelectorAll("main *")].filter((el) => {
            const s = getComputedStyle(el);
            return (
              s.opacity === "0" &&
              (el as HTMLElement).offsetHeight > 20 &&
              !el.closest("[aria-hidden='true']")
            );
          }).length,
      );
      expect(stuck, `stuck invisible elements (${reducedMotion})`).toBe(0);
      await ctx.close();
    }
  });

  test("the code-to-graph story and exploration showcase respond", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /import ".\/c"/ }).click();
    await expect(page.getByText("Highlighted: the edge from")).toContainText("b.ts");
    await page.getByRole("button", { name: "Imported by" }).click();
    await expect(page.getByRole("button", { name: "Imported by" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("the live product section drives the real inspector", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section", {
      has: page.getByRole("heading", { name: /This is the real workspace/ }),
    });
    await section.getByRole("treeitem").filter({ hasText: "main.ts" }).first().click();
    await expect(section.getByRole("heading", { name: /^Imports \(/ })).toBeVisible();
    await expect(section.getByText(/Potential change impact/)).toBeVisible();
  });
});
