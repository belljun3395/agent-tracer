import { defineConfig } from "tsup";
export default defineConfig({
    entry: {
        index: "src/index.ts",
        mcp: "src/adapters/mcp/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
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
