import { defineConfig, devices } from "@playwright/test";

// Les parcours tournent contre l'application démarrée (docker compose up, ou dev local).
// Ils partagent la même base : un seul worker évite que deux tests visent le même créneau.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "fr-CA",
    timezoneId: "America/Toronto",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-375",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
});
