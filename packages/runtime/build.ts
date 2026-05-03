import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { collectHookEntrypoints } from "./build/hook-discovery.js";

const runtimeRoot = import.meta.dirname;
const hooksRoot = path.join(runtimeRoot, "src/claude-code/hooks");
const outdir = path.join(runtimeRoot, "dist/claude-code/hooks");

const sourcemapMode = (process.env.RUNTIME_BUILD_SOURCEMAP ?? "external").toLowerCase();
const sourcemap: "inline" | "external" | false =
    sourcemapMode === "inline" ? "inline" : sourcemapMode === "off" ? false : "external";

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const entryPoints = await collectHookEntrypoints(hooksRoot);

await build({
    entryPoints,
    outbase: hooksRoot,
    outdir,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    sourcemap,
    packages: "external",
    tsconfig: path.join(runtimeRoot, "tsconfig.plugin.json"),
    alias: {
        "~shared": path.join(runtimeRoot, "src/shared"),
        "~claude-code": path.join(runtimeRoot, "src/claude-code"),
    },
    logLevel: "info",
});

process.stdout.write(`[runtime-build] bundled ${entryPoints.length} Claude Code hook entries into ${outdir} (sourcemap=${sourcemap})\n`);
