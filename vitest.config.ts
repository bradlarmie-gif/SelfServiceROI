import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const assetStub = path.resolve(
  __dirname,
  "client",
  "src",
  "__tests__",
  "__fixtures__",
  "asset-stub.ts",
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^.*\.(ttf|otf|woff2?|png|jpe?g|gif|svg|webp|ico|bmp|avif)$/, replacement: assetStub },
      { find: "@assets", replacement: path.resolve(__dirname, "attached_assets") },
      { find: "@shared", replacement: path.resolve(__dirname, "shared") },
      { find: "@", replacement: path.resolve(__dirname, "client", "src") },
    ],
  },
  test: {
    include: ["client/src/__tests__/**/*.test.{ts,tsx}"],
  },
});
