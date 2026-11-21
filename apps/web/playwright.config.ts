import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
const API_PORT = Number(process.env.E2E_API_PORT ?? 4000);
const root = path.resolve(import.meta.dirname, "../..");

/** The memory API (offline, real pipeline) exists once apps/api defines dev:memory. */
const apiScripts = (() => {
  try {
    return readFileSync(path.join(root, "apps/api/package.json"), "utf8");
  } catch {
    return "";
  }
})();
const hasApi =
  existsSync(path.join(root, "apps/api/src/main.ts")) &&
  apiScripts.includes("dev:memory") &&
  process.env.E2E_NO_API !== "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Production build: what ships is what is tested.
      command: `pnpm exec next build && pnpm exec next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: process.env.E2E_REUSE === "1",
      timeout: 300_000,
      env: { ARCHMAP_API_URL: `http://localhost:${API_PORT}` },
    },
    ...(hasApi
      ? [
          {
            command: "pnpm --filter @archmap/api dev:memory",
            cwd: root,
            url: `http://localhost:${API_PORT}/health/live`,
            reuseExistingServer: process.env.E2E_REUSE === "1",
            timeout: 60_000,
            env: {
              PORT: String(API_PORT),
              WEB_ORIGINS: `http://localhost:${WEB_PORT}`,
              ARCHMAP_LIMIT_SUBMISSIONS_PER_CLIENT_PER_HOUR: "1000",
            },
          },
        ]
      : []),
  ],
});
