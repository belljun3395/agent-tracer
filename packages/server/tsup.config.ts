import { defineConfig } from "tsup";
export default defineConfig({
    entry: {
        index: "src/server.entry.ts",
        mcp: "src/adapters/mcp/mcp.entry.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    tsconfig: "tsconfig.json",
    external: [
        "@huggingface/transformers",
        "@monitor/domain",
        "@monitor/classification",
        "@monitor/application",
        "express",
        "ws",
        "zod",
        "@nestjs/common",
        "@nestjs/core",
        "@nestjs/platform-express",
        "reflect-metadata",
        "class-transformer",
        "class-validator"
    ]
});
