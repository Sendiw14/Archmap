import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Page } from "@playwright/test";

export const STATIC_ROUTES = [
  "/",
  "/demo",
  "/import",
  "/docs",
  "/docs/getting-started",
  "/docs/cli",
  "/docs/architecture",
  "/docs/analysis-coverage",
  "/docs/troubleshooting",
  "/privacy",
  "/security",
  "/this-page-does-not-exist",
];

export const CIRCULAR_NODE = "file:a.ts";
export const ANALYSIS_ROUTES = [
  "/analyses/demo-archmap",
  "/analyses/demo-archmap/insights",
  `/analyses/demo-archmap/files?node=${encodeURIComponent("file:packages/graph-core/src/index.ts")}`,
  "/analyses/demo-archmap/report",
  "/analyses/demo-circular",
  "/analyses/demo-circular/insights",
  "/analyses/demo-synthetic-1000",
];

export const ALL_ROUTES = [...STATIC_ROUTES, ...ANALYSIS_ROUTES];

/** The walkthrough opens by itself on first visit; tests that are not about it dismiss it. */
export async function dismissTour(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("archmap.demo.tour-dismissed", "1");
    } catch {
      /* ignore */
    }
  });
}

/** Wait until a route has rendered its real content (not a loading state). */
export async function waitForRoute(page: Page, path: string) {
  const p = path.split("?")[0]!;
  if (p.startsWith("/analyses/")) {
    await expect(page.getByRole("navigation", { name: "Analysis sections" })).toBeVisible();
    if (p.endsWith("/insights"))
      await expect(page.getByRole("heading", { name: "Repository metrics" })).toBeVisible();
    else if (p.endsWith("/files"))
      await expect(page.getByRole("heading", { name: "Files", level: 2 })).toBeVisible();
    else if (p.endsWith("/report"))
      await expect(page.getByRole("heading", { name: "Exports" })).toBeVisible();
    else
      await expect(page.locator(".react-flow__node, button[data-row]").first()).toBeVisible({
        timeout: 30_000,
      });
  } else if (p === "/demo") {
    await expect(page.locator(".react-flow__node, button[data-row]").first()).toBeVisible({
      timeout: 30_000,
    });
  } else {
    await expect(page.locator("main h1")).toBeVisible();
  }
}

export async function serious(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
}

export async function expectNoSeriousViolations(page: Page) {
  expect(await serious(page), "axe serious/critical violations").toEqual([]);
}

/** A deterministic uuid-shaped id for mocked API responses. */
export const MOCK_ID = "3f2b8d3e-7f0a-4a52-9c1f-0e5f2f0d6a11";

export function summary(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: MOCK_ID,
    repository: {
      owner: "mock-owner",
      repo: "mock-repo",
      url: "https://github.com/mock-owner/mock-repo",
    },
    ref: null,
    commit: "a".repeat(40),
    status,
    error: null,
    analyzerVersion: "0.1.0",
    schemaVersion: "1.0.0",
    stats: null,
    createdAt: new Date(Date.now() - 20_000).toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 23 * 3600_000).toISOString(),
    ...extra,
  };
}
