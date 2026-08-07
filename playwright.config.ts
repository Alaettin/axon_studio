import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Die Pruefungen teilen sich zwei Zugaenge und aendern echte Zeilen. Parallel wuerden sie
  // sich gegenseitig die Freischaltungen umlegen.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5274",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "de-DE",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --port 5274",
    url: "http://localhost:5274",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
