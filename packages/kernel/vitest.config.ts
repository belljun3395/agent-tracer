import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { target: "es2022" },
  resolve: {
    alias: { "~kernel": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    name: "kernel",
    include: ["src/**/*.test.ts"],
  },
});
