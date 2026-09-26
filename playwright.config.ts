import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Creates the fixture user before any spec runs. Sign-up is disabled by
  // design, so the user cannot be created through the application.
  globalSetup: "./tests/e2e/global-setup.ts",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  /**
   * One worker, deliberately.
   *
   * The application is single-user and its rules are one-at-a-time: one active
   * cycle, one active mission. Two spec files running concurrently fight over
   * the same single slot and fail in ways that look like product bugs and are
   * not. The suite cannot be more parallel than the domain it tests.
   */
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Capturing a curiosity has to work well on a small screen, so the mobile
    // viewport is a first-class target rather than an afterthought.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
