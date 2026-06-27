import { defineConfig } from "vitest/config";
import { resolve } from "path";
import swc from "unplugin-swc";

export default defineConfig({
    resolve: {
        alias: {
            "~adapters": resolve(__dirname, "src/adapters"),
            "~main": resolve(__dirname, "src/main"),
            "~config": resolve(__dirname, "src/config"),
            "@monitor/shared-kernel": resolve(__dirname, "../shared-kernel/src"),
            "@monitor/contracts": resolve(__dirname, "../contracts/src"),
            "@monitor/activity": resolve(__dirname, "../activity/src"),
            "@monitor/work": resolve(__dirname, "../work/src"),
            "@monitor/governance": resolve(__dirname, "../governance/src"),
            "@monitor/llm": resolve(__dirname, "../llm/src"),
            "@monitor/identity": resolve(__dirname, "../identity/src"),
            "@monitor/ws-gateway": resolve(__dirname, "../ws-gateway/src"),
            "@monitor/mcp": resolve(__dirname, "../mcp/src"),
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
            "../contracts/src/**/*.test.ts",
            "../shared-kernel/src/**/*.test.ts",
            "../activity/src/**/*.test.ts",
            "../work/src/**/*.test.ts",
            "../governance/src/**/*.test.ts",
            "../llm/src/**/*.test.ts",
            "../identity/src/**/*.test.ts",
        ],
    },
});
