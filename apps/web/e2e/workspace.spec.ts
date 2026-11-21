import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dismissTour } from "./helpers";

const graphNodes = (page: Page) =>
  page.getByRole("region", { name: "Dependency graph" }).locator(".react-flow__node");

test.describe("offline workspace on demo data (/analyses/demo-<sample>)", () => {
  test.beforeEach(async ({ context }) => dismissTour(context));

  test("header shows identity, status, analyzer, share, export and help", async ({ page }) => {
    await page.goto("/analyses/demo-archmap");
    const header = page
      .locator("header")
      .filter({ has: page.getByRole("heading", { level: 1 }) })
      .last();
    await expect(header.getByRole("heading", { level: 1 })).toHaveText("ARCHMAP (this repository)");
    await expect(header.getByText("Completed").first()).toBeVisible();
    await expect(header.getByText("509555b").first()).toBeVisible();
    await expect(header.getByText("0.1.0").first()).toBeVisible();
    await expect(header.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Export" })).toHaveAttribute(
      "href",
      /\/report#exports$/,
    );
    await header.getByRole("button", { name: "Help" }).click();
    const dialog = page.getByRole("dialog", { name: "Using the workspace" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    // no management controls without canManage
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  });

  test("has noindex robots metadata", async ({ page, request }) => {
    await page.goto("/analyses/demo-circular");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const res = await request.get("/analyses/demo-circular");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
  });

  test("Share copies the analysis URL without a query", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/analyses/demo-circular?node=file%3Aa.ts");
    await page.getByRole("button", { name: "Share" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      /\/analyses\/demo-circular$/,
    );
  });

  test("deep link ?node= selects the module and ?cycle= the cycle", async ({ page }) => {
    await page.goto("/analyses/demo-circular?node=file%3Ab.ts");
    await expect(
      page.getByRole("complementary", { name: "Inspector" }).getByRole("heading", { name: "b.ts" }),
    ).toBeVisible();
    await page.goto("/analyses/demo-circular?cycle=first");
    await expect(
      page
        .getByRole("complementary", { name: "Inspector" })
        .getByRole("heading", { name: /Runtime cycle/ }),
    ).toBeVisible();
  });

  test("insights: metrics, cycles with evidence, methodology", async ({ page }) => {
    await page.goto("/analyses/demo-circular/insights");
    await expect(page.getByRole("heading", { name: "Repository metrics" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Dependency cycles/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Runtime cycle, 3 modules" })).toBeVisible();
    await expect(
      page.getByRole("table", { name: /Imports that form/ }).getByText("a.ts:1:1"),
    ).toBeVisible();
    await page.getByRole("link", { name: "Open in graph" }).first().click();
    await expect(page).toHaveURL(/\/analyses\/demo-circular\?cycle=/);
    await expect(
      page
        .getByRole("complementary", { name: "Inspector" })
        .getByRole("heading", { name: /Runtime cycle/ }),
    ).toBeVisible();
    await page.goto("/analyses/demo-archmap/insights");
    await expect(page.getByRole("heading", { name: "Methodology and limitations" })).toBeVisible();
    await expect(page.getByText("scc-tarjan@1").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Package relationships/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Unresolved imports/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Diagnostics/ })).toBeVisible();
  });

  test("files: search, select, imports with evidence, no symbol claims, open in graph", async ({
    page,
  }) => {
    await page.goto("/analyses/demo-archmap/files");
    await expect(page.getByText("Choose a file")).toBeVisible();
    await page.getByRole("textbox", { name: /Search files by path/ }).fill("graph-core");
    await page.getByRole("treeitem").filter({ hasText: "findings.ts" }).first().click();
    await expect(page).toHaveURL(/node=/);
    await expect(page.getByRole("heading", { name: "findings.ts", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Imports \(/ })).toBeVisible();
    await expect(page.getByText(/findings\.ts:\d+:\d+/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Symbols and exports" })).toBeVisible();
    await expect(page.getByText(/not extracted/)).toBeVisible();
    await page.getByRole("link", { name: "Open in graph" }).click();
    await expect(page).toHaveURL(/\/analyses\/demo-archmap\?node=/);
    await expect(
      page
        .getByRole("complementary", { name: "Inspector" })
        .getByRole("heading", { name: "findings.ts" }),
    ).toBeVisible();
  });

  test("report downloads: JSON graph, Markdown computed offline, sanitized SVG", async ({
    page,
  }) => {
    await page.goto("/analyses/demo-circular/report");
    await expect(page.getByRole("heading", { name: "Exports" })).toBeVisible();

    const [json] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download JSON" }).click(),
    ]);
    const g = JSON.parse(readFileSync((await json.path())!, "utf8"));
    expect(g.nodes).toHaveLength(4);
    expect(g.metadata.schemaVersion).toBe("1.0.0");

    const [md] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download Markdown" }).click(),
    ]);
    expect(md.suggestedFilename()).toMatch(/report\.md$/);
    const text = readFileSync((await md.path())!, "utf8");
    expect(text).toContain("# ARCHMAP report: circular");
    expect(text).toContain("## Cycles");
    await expect(page.getByText("generated in this browser")).toBeVisible();

    const [svg] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download SVG" }).click(),
    ]);
    const s = readFileSync((await svg.path())!, "utf8");
    expect(s.startsWith("<svg ")).toBe(true);
    expect(s).toContain("a.ts");
    expect(s).not.toMatch(/<script|<foreignObject|\son[a-z]+=|javascript:|<style/i);
  });

  test("report page covers identity, versions, scope, summary, findings, cycles, diagnostics, limitations", async ({
    page,
  }) => {
    await page.goto("/analyses/demo-archmap/report");
    for (const h of [
      "Identity",
      "Versions and status",
      "Scope",
      "Summary",
      /^Findings/,
      "Cycles",
      /^Diagnostics/,
      "Limitations",
    ])
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    await expect(page.getByText("509555bbd72b6d25a0384cf0b0cc81890fa8d03f")).toBeVisible();
  });

  test("Export SVG from the graph view downloads the current view without active content", async ({
    page,
  }) => {
    await page.goto("/analyses/demo-circular");
    await graphNodes(page).filter({ hasText: "a.ts" }).first().click();
    const [svg] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export SVG" }).click(),
    ]);
    const s = readFileSync((await svg.path())!, "utf8");
    expect(s).toContain("<svg");
    expect(s).not.toMatch(/<script|<foreignObject|\son[a-z]+=/i);
    // the selection is part of the exported view
    expect(s).toContain("#3452d1");
  });

  test("persistent navigation: tabs keep the analysis loaded", async ({ page }) => {
    await page.goto("/analyses/demo-archmap");
    const nav = page.getByRole("navigation", { name: "Analysis sections" });
    await nav.getByRole("link", { name: "Insights" }).click();
    await expect(page).toHaveURL(/insights$/);
    await expect(page.getByRole("heading", { name: "Repository metrics" })).toBeVisible();
    await nav.getByRole("link", { name: "Report" }).click();
    await expect(nav.getByRole("link", { name: "Report" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Graph" }).click();
    await expect(graphNodes(page).first()).toBeVisible();
  });
});

test.describe("large-graph aggregation", () => {
  test.beforeEach(async ({ context }) => dismissTour(context));

  test("1,000 modules start grouped; clicking a group expands it", async ({ page }) => {
    await page.goto("/analyses/demo-synthetic-1000");
    await expect(page.getByText("Synthetic benchmark graph").first()).toBeVisible();
    await expect(page.getByText(/Large graph: starting grouped by folder/)).toBeVisible();
    await expect(graphNodes(page).first()).toBeVisible({ timeout: 30_000 });
    const info = page.getByText(/modules drawn as \d+ items/);
    await expect(info).toBeVisible();
    const before = Number(
      (await info.textContent())!.match(/drawn as ([\d,]+) items/)![1]!.replace(/,/g, ""),
    );
    expect(before).toBeLessThan(200);
    const group = graphNodes(page).filter({ hasText: "click to expand" }).first();
    // keyboard path: nodes are focusable and Enter expands, so the test does not depend on the viewport
    await group.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Expanded .*now shown individually/)).toBeAttached();
    await expect(async () => {
      const after = Number(
        (await info.textContent())!.match(/drawn as ([\d,]+) items/)![1]!.replace(/,/g, ""),
      );
      expect(after).not.toBe(before);
    }).toPass();
  });

  test("search reveals a module hidden inside a collapsed group", async ({ page }) => {
    await page.goto("/analyses/demo-synthetic-1000");
    await expect(graphNodes(page).first()).toBeVisible({ timeout: 30_000 });
    const search = page.getByRole("combobox", { name: /Search modules by path/ });
    await search.fill("module-0123");
    await search.press("Enter");
    await expect(
      page
        .getByRole("complementary", { name: "Inspector" })
        .getByRole("heading", { name: "module-0123.ts" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(graphNodes(page).filter({ hasText: "module-0123.ts" })).toHaveCount(1, {
      timeout: 30_000,
    });
  });
});
