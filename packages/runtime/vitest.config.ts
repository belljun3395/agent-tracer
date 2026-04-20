import * as path from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
    esbuild: {
        target: "es2022",
    },
    resolve: {
        alias: {
            "~shared": path.resolve(__dirname, "src/shared"),
            "~claude-code": path.resolve(__dirname, "src/claude-code"),
            "~codex": path.resolve(__dirname, "src/codex"),
        },
    },
    test: {
        include: ["test/**/*.test.ts", "src/**/*.test.ts"],
        passWithNoTests: true,
    }
});
