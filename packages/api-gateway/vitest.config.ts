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
            "@monitor/activity-api": resolve(__dirname, "../activity-api/src"),
            "@monitor/work-api": resolve(__dirname, "../work-api/src"),
            "@monitor/governance-api": resolve(__dirname, "../governance-api/src"),
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
            "../activity-api/src/**/*.test.ts",
            "../work-api/src/**/*.test.ts",
            "../governance-api/src/**/*.test.ts",
            "../identity-api/src/**/*.test.ts",
        ],
    },
});
