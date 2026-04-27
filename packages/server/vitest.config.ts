import { defineConfig } from "vitest/config";
import { resolve } from "path";
import swc from "unplugin-swc";

export default defineConfig({
    resolve: {
        alias: {
            "~domain": resolve(__dirname, "src/domain"),
            "~application": resolve(__dirname, "src/application"),
            "~adapters": resolve(__dirname, "src/adapters"),
            "~main": resolve(__dirname, "src/main"),
            "~session": resolve(__dirname, "src/session"),
            "~task": resolve(__dirname, "src/task"),
            "~event": resolve(__dirname, "src/event"),
            "~rule": resolve(__dirname, "src/rule"),
            "~verification": resolve(__dirname, "src/verification"),
            "~turn-partition": resolve(__dirname, "src/turn-partition"),
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
    },
});
