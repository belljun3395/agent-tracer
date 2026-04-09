import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const setupExternalScript = path.join(repoRoot, "scripts", "setup-external.mjs");
describe("setup:external Claude integration", () => {
    const tempDirs: string[] = [];
    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    });
    it("writes plugin-mode settings without legacy hooks or vendored scripts", async () => {
        const targetDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-setup-"));
        tempDirs.push(targetDir);
        const { stdout } = await execFileAsync(process.execPath, [
            setupExternalScript,
            "--target",
            targetDir,
            "--source-root",
            repoRoot
        ], {
            cwd: repoRoot
        });
        const generatedSettings = JSON.parse(await readFile(path.join(targetDir, ".claude", "settings.json"), "utf8")) as {
            hooks?: unknown;
            permissions?: {
                defaultMode?: string;
                allow?: string[];
            };
        };
        expect(generatedSettings.hooks).toBeUndefined();
        expect(generatedSettings.permissions?.defaultMode).toBe("acceptEdits");
        expect(generatedSettings.permissions?.allow).toEqual(expect.arrayContaining(["WebSearch", "WebFetch"]));
        await expect(readFile(path.join(targetDir, ".agent-tracer", ".claude", "hooks", "common.ts"), "utf8")).rejects.toThrow();
        await expect(readFile(path.join(targetDir, ".agent-tracer", ".claude", "hooks", "session_start.ts"), "utf8")).rejects.toThrow();
        const expectedPluginPath = path.join(repoRoot, ".claude", "plugin");
        expect(stdout).toContain(expectedPluginPath);
        expect(stdout).toContain("claude --plugin-dir");
    }, 60000);
    it("strips a legacy hooks block from a pre-existing settings.json", async () => {
        const targetDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-setup-legacy-"));
        tempDirs.push(targetDir);
        await mkdir(path.join(targetDir, ".claude"), { recursive: true });
        await writeFile(path.join(targetDir, ".claude", "settings.json"), JSON.stringify({
            hooks: {
                SessionStart: [
                    { hooks: [{ type: "command", command: "old vendored command" }] }
                ]
            },
            permissions: { defaultMode: "ask", allow: ["WebSearch"] }
        }));
        await execFileAsync(process.execPath, [
            setupExternalScript,
            "--target",
            targetDir,
            "--source-root",
            repoRoot
        ], {
            cwd: repoRoot
        });
        const generatedSettings = JSON.parse(await readFile(path.join(targetDir, ".claude", "settings.json"), "utf8")) as {
            hooks?: unknown;
            permissions?: {
                defaultMode?: string;
                allow?: string[];
            };
        };
        expect(generatedSettings.hooks).toBeUndefined();
        expect(generatedSettings.permissions?.defaultMode).toBe("ask");
        expect(generatedSettings.permissions?.allow).toEqual(expect.arrayContaining(["WebSearch"]));
    }, 60000);
});
