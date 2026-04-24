import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    resolve: {
        alias: {
            "~domain": resolve(__dirname, "src/domain"),
            "~application": resolve(__dirname, "src/application"),
            "~adapters": resolve(__dirname, "src/adapters"),
            "~main": resolve(__dirname, "src/main"),
        }
    },
    esbuild: {
        target: "es2022",
        tsconfigRaw: {
            compilerOptions: {
                experimentalDecorators: true
            }
        }
    },
    test: {
        passWithNoTests: true,
    }
});
