import { defineConfig } from "vitest/config";
import { resolve } from "path";
import swc from "unplugin-swc";

export default defineConfig({
    resolve: {
        alias: {
            "~adapters": resolve(__dirname, "src/adapters"),
            "~main": resolve(__dirname, "src/main"),
            "~activity": resolve(__dirname, "src/activity"),
            "~work": resolve(__dirname, "src/work"),
            "~governance": resolve(__dirname, "src/governance"),
            "~config": resolve(__dirname, "src/config"),
        },
    },
    plugins: [
        swc.vite({
            module: { type: "es6" },
            jsc: {
                target: "es2022",
                parser: { syntax: "typescript", decorators: true },
                transform: { legacyDecorator: true, decoratorMetadata: true },
            },
        }),
    ],
    test: {
        passWithNoTests: true,
        setupFiles: ["./vitest.setup.ts"],
    },
});
