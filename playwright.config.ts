import { defineConfig } from "@playwright/test";

const PORT = 5055;

/**
 * Responsive e2e: drives the built client in a real headless Chromium across
 * phone / tablet / desktop viewports and asserts no horizontal overflow. Serves
 * the static client (the full server needs DATABASE_URL), so run `npm run build`
 * first (the webServer command does it for you).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run build && node e2e/static-server.cjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
