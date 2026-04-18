import { defineConfig } from "tsup";
export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    external: [
        "@huggingface/transformers",
        "@monitor/domain",
        "@monitor/classification",
        "@monitor/application",
        "better-sqlite3",
        "express",
        "ws",
        "zod",
        "@nestjs/common",
        "@nestjs/core",
        "@nestjs/platform-express",
        "reflect-metadata",
        "class-transformer",
        "class-validator",
        "yaml"
    ]
});
