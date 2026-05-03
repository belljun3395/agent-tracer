import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const runtimeRoot = path.resolve(__dirname, "..");
const runner = path.join(runtimeRoot, "src/claude-code/bin/run-hook.sh");

function runHook(pluginRoot: string, hookName: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve, reject) => {
        const child = spawn(runner, [hookName], {
            cwd: runtimeRoot,
            env: {
                ...process.env,
                CLAUDE_PLUGIN_ROOT: pluginRoot,
                NODE_ENV: "production",
            },
            stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.on("error", reject);
        child.on("close", (code) => resolve({ stdout, stderr, code }));
        child.stdin.end("{}\n");
    });
}

describe("Claude Code run-hook.sh", () => {
    it("prefers compiled dist hook over TypeScript source when both exist", async () => {
        const root = await mkdtemp(path.join(tmpdir(), "agent-tracer-plugin-"));
        await mkdir(path.join(root, "hooks"), { recursive: true });
        await mkdir(path.join(root, "dist/claude-code/hooks"), { recursive: true });
        await writeFile(path.join(root, "hooks/Example.ts"), "throw new Error('tsx source should not run');\n");
        await writeFile(
            path.join(root, "dist/claude-code/hooks/Example.js"),
            "process.stdout.write('compiled-hook-ran\\n');\n",
        );

        const result = await runHook(root, "Example");

        expect(result.code).toBe(0);
        expect(result.stdout).toBe("compiled-hook-ran\n");
        expect(result.stderr).not.toContain("tsx source should not run");
    });

    it("falls back to nested compiled hook paths", async () => {
        const root = await mkdtemp(path.join(tmpdir(), "agent-tracer-plugin-"));
        await mkdir(path.join(root, "hooks/PostToolUse"), { recursive: true });
        await mkdir(path.join(root, "dist/claude-code/hooks/PostToolUse"), { recursive: true });
        await writeFile(path.join(root, "hooks/PostToolUse/Bash.ts"), "throw new Error('tsx source should not run');\n");
        await writeFile(
            path.join(root, "dist/claude-code/hooks/PostToolUse/Bash.js"),
            "process.stdout.write('compiled-nested-hook-ran\\n');\n",
        );

        const result = await runHook(root, "PostToolUse/Bash");

        expect(result.code).toBe(0);
        expect(result.stdout).toBe("compiled-nested-hook-ran\n");
        expect(result.stderr).not.toContain("tsx source should not run");
    });
});
