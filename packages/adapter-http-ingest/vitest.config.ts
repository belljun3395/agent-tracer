import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    target: "es2022",
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true
      }
    }
  },
  test: {
    environment: "node",
    globals: true
  }
});
