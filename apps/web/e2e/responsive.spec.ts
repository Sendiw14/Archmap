import { expect, test } from "@playwright/test";
import { ALL_ROUTES, dismissTour, waitForRoute } from "./helpers";

const WIDTHS = [360, 390, 430, 768, 1024, 1440, 1920];

/** Spec 12.1: no page-level horizontal overflow at any representative width. */
test.describe("no horizontal overflow", () => {
  for (const width of WIDTHS) {
    test(`all routes at ${width}px`, async ({ browser }) => {
      test.setTimeout(240_000);
      const ctx = await browser.newContext({
        viewport: { width, height: width < 768 ? 800 : 900 },
        reducedMotion: "reduce",
      });
      await dismissTour(ctx);
      const page = await ctx.newPage();
      await page.route("**/health/ready", (r) =>
        r.fulfill({ status: 200, contentType: "application/json", body: '{"status":"ok"}' }),
      );
      const bad: string[] = [];
      for (const route of ALL_ROUTES) {
        await page.goto(route);
        await waitForRoute(page, route);
        await page.waitForTimeout(250);
        const over = await page.evaluate(() => {
          const doc = document.documentElement;
          const wide = [...document.querySelectorAll("body *")]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.right > doc.clientWidth + 1 &&
                !el.closest(
                  "[role='region'][tabindex], .react-flow, [role='tree'], .am-table-wrap, pre, .overflow-x-auto, svg",
                )
              );
            })
            .slice(0, 3)
            .map(
              (el) =>
                `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 60)}`,
            );
          return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, wide };
        });
        if (over.scrollWidth > over.clientWidth + 1)
          bad.push(
            `${route}: scrollWidth ${over.scrollWidth} > ${over.clientWidth} (${over.wide.join(", ")})`,
          );
      }
      expect(bad, bad.join("\n")).toEqual([]);
      await ctx.close();
    });
  }
});
