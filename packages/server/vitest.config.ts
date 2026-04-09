import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    // Enable TypeScript decorator support (required for NestJS decorators in tests)
    target: "es2022",
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true
      }
    }
  },
  test: {
    setupFiles: ["./test/vitest-setup.ts"]
  }
});
