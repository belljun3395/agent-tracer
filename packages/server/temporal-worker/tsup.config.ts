import { defineConfig } from "tsup";

export default defineConfig({
    // 워커 본체와 워크플로를 분리 산출 — Temporal은 워크플로를 별도 경로에서 다시 번들한다.
    entry: {
        worker: "src/worker.entry.ts",
        "workflows/index": "src/workflows/index.ts",
    },
    format: ["esm"],
    dts: false,
    clean: true,
    tsconfig: "tsconfig.json",
    // 워크스페이스 패키지는 소스로 배포되므로 번들에 인라인한다.
    noExternal: [/^@monitor\//],
    external: [
        "@temporalio/worker",
        "@temporalio/activity",
        "@temporalio/workflow",
        "@temporalio/client",
        "@nestjs/common",
        "@nestjs/core",
        "@nestjs/typeorm",
        "reflect-metadata",
        "typeorm",
        "typeorm-transactional",
        "pg",
        "redis",
        "express",
        "ws",
        "zod",
        "@anthropic-ai/sdk",
        "@anthropic-ai/claude-agent-sdk",
    ],
});
