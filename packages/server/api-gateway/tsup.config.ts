import { defineConfig } from "tsup";
export default defineConfig({
    entry: {
        index: "src/gateway.entry.ts",
        mcp: "../shared/src/mcp/mcp.entry.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    tsconfig: "tsconfig.json",
    external: [
        "@huggingface/transformers",
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
