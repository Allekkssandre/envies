import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
export const FIXTURE_PORT = 4599;

/** Chaque parcours tourne à 1440 px (desktop) et 390 px (mobile). */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    // Pages produit locales pour l'extraction (tests/e2e/fixture-server.mjs).
    {
      command: `node tests/e2e/fixture-server.mjs`,
      url: `http://127.0.0.1:${FIXTURE_PORT}/`,
      env: { FIXTURE_PORT: String(FIXTURE_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    ...(process.env.PLAYWRIGHT_BASE_URL
      ? []
      : [
          {
            command: `pnpm build && pnpm start --port ${PORT}`,
            url: baseURL,
            // Seul serveur autorisé à lire ces pages locales (jamais en production).
            env: { ENRICH_TEST_ALLOW: `127.0.0.1:${FIXTURE_PORT}` },
            reuseExistingServer: !process.env.CI,
            timeout: 240_000,
          },
        ]),
  ],
});
