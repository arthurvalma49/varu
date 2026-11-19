import { defineConfig } from "@playwright/test";

/**
 * Browser tests for the main flows, on a phone-size screen against the production build.
 * Uses the installed Google Chrome (channel "chrome"), so no browser download is needed.
 * Run: npm run test:e2e
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4174",
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    hasTouch: false,
    serviceWorkers: "block",
    locale: "et-EE",
    timezoneId: "Europe/Tallinn",
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4174 --strictPort",
    url: "http://localhost:4174",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
