import { defineConfig } from "tsup";
export default defineConfig({
    entry: {
        index: "src/gateway.entry.ts",
        mcp: "src/mcp/mcp.entry.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    tsconfig: "tsconfig.json",
    // Workspace packages are published as TS source (exports map to ./src/*),
    // so they must be bundled — otherwise the built entry imports
    // @monitor/*/src/*.js paths that do not exist at runtime.
    noExternal: [/^@monitor\//],
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
