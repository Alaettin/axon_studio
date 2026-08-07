import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Ohne diese Einschraenkung zieht vitest die Playwright-Dateien in `e2e/` mit herein
    // (Vorgabe ist unter anderem `**/*.spec.ts`) und scheitert an deren Import.
    include: ["test/**/*.test.ts"],
  },
});
