import { defineConfig } from "vitest/config";
import { resolve } from "path";
import swc from "unplugin-swc";

export default defineConfig({
    resolve: {
        alias: {
            "~adapters": resolve(__dirname, "src/adapters"),
            "~main": resolve(__dirname, "src/main"),
            "~config": resolve(__dirname, "src/config"),
            "@monitor/shared": resolve(__dirname, "../shared/src"),
            "@monitor/timeline-api": resolve(__dirname, "../timeline-api/src"),
            "@monitor/run-api": resolve(__dirname, "../run-api/src"),
            "@monitor/rules-api": resolve(__dirname, "../rules-api/src"),
            "@monitor/insight-api": resolve(__dirname, "../insight-api/src"),
            "@monitor/identity-api": resolve(__dirname, "../identity-api/src"),
            "@monitor/ws-gateway": resolve(__dirname, "../ws-gateway/src"),
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
        // server src + 백엔드 워크스페이스 패키지의 테스트를 함께 수행한다(web/runtime 제외).
        include: [
            "src/**/*.test.ts",
            "../shared/src/**/*.test.ts",
            "../timeline-api/src/**/*.test.ts",
            "../run-api/src/**/*.test.ts",
            "../rules-api/src/**/*.test.ts",
            "../insight-api/src/**/*.test.ts",
            "../identity-api/src/**/*.test.ts",
        ],
    },
});
