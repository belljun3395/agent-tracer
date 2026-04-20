import { defineConfig } from "vitest/config";
export default defineConfig({
    esbuild: {
        target: "es2022",
    },
    test: {
        include: ["test/**/*.test.ts", "src/**/*.test.ts"],
        passWithNoTests: true,
    }
});
