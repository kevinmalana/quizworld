import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./scripts",
  testMatch: "live-ui.spec.ts",
  outputDir: "test-results/live",
});
