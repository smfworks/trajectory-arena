import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3108);
const baseURL = `http://127.0.0.1:${port}`;
const dataDir =
  process.env.PLAYWRIGHT_DATA_DIR ?? join(tmpdir(), `trajectory-arena-playwright-${process.pid}`);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run prepare:standalone && node .next/standalone/server.js",
    url: `${baseURL}/api/health`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      NODE_ENV: "production",
      TRAJECTORY_DATA_DIR: dataDir,
      TRAJECTORY_ALLOW_UNAUTHENTICATED: "true",
      TRAJECTORY_ENABLE_SEED: "true",
      TRAJECTORY_PUBLIC_ORIGIN: baseURL,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
