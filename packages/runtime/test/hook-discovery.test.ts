import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectHookEntrypoints } from "../build/hook-discovery.js";

async function fixture(structure: Record<string, string | null>): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), "hook-discovery-"));
    for (const [relativePath, contents] of Object.entries(structure)) {
        const full = path.join(root, relativePath);
        if (contents === null) {
            await mkdir(full, { recursive: true });
        } else {
            await mkdir(path.dirname(full), { recursive: true });
            await writeFile(full, contents);
        }
    }
    return root;
}

describe("collectHookEntrypoints", () => {
    it("includes capitalized .ts files at the root", async () => {
        const root = await fixture({
            "PreToolUse.ts": "",
            "SessionStart.ts": "",
        });
        const entries = await collectHookEntrypoints(root);
        expect(entries.map((p) => path.relative(root, p)).sort()).toEqual([
            "PreToolUse.ts",
            "SessionStart.ts",
        ]);
    });

    it("recurses into capitalized subdirectories", async () => {
        const root = await fixture({
            "PostToolUse/Bash.ts": "",
            "PostToolUse/Read.ts": "",
        });
        const entries = await collectHookEntrypoints(root);
        expect(entries.map((p) => path.relative(root, p)).sort()).toEqual([
            "PostToolUse/Bash.ts",
            "PostToolUse/Read.ts",
        ]);
    });

    it("excludes lowercase helper directories without an explicit allow-list", async () => {
        const root = await fixture({
            "PreToolUse.ts": "",
            "lib/runtime.ts": "",
            "util/utils.ts": "",
            "helpers/anything.ts": "",
        });
        const entries = await collectHookEntrypoints(root);
        expect(entries.map((p) => path.relative(root, p))).toEqual(["PreToolUse.ts"]);
    });

    it("excludes _-prefixed files and directories", async () => {
        const root = await fixture({
            "PostToolUse/Bash.ts": "",
            "PostToolUse/_shared.ts": "",
            "PostToolUse/_helpers/util.ts": "",
            "_disabled/Skipped.ts": "",
        });
        const entries = await collectHookEntrypoints(root);
        expect(entries.map((p) => path.relative(root, p))).toEqual(["PostToolUse/Bash.ts"]);
    });

    it("excludes test files", async () => {
        const root = await fixture({
            "PreToolUse.ts": "",
            "PreToolUse.test.ts": "",
        });
        const entries = await collectHookEntrypoints(root);
        expect(entries.map((p) => path.relative(root, p))).toEqual(["PreToolUse.ts"]);
    });
});
