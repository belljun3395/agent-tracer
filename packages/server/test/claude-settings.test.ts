import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

interface HookCommand {
  readonly type?: string;
  readonly command?: string;
}

interface HookMatcher {
  readonly hooks?: readonly HookCommand[];
}

interface ClaudeSettings {
  readonly hooks?: Record<string, readonly HookMatcher[]>;
}

function repoRootPath(): string {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(testDir, "../../..");
}

function loadHookCommands(): string[] {
  const repoRoot = repoRootPath();
  const filePath = path.join(repoRoot, ".claude/settings.json");
  const settings = JSON.parse(fs.readFileSync(filePath, "utf8")) as ClaudeSettings;

  return Object.values(settings.hooks ?? {})
    .flat()
    .flatMap((matcher) => matcher.hooks ?? [])
    .filter((hook) => hook.type === "command" && typeof hook.command === "string")
    .map((hook) => hook.command as string);
}

describe("repo Claude hook config", () => {
  it("skips Claude hook commands when OpenCode is running", () => {
    const commands = loadHookCommands();

    expect(commands.length).toBeGreaterThan(0);

    for (const command of commands) {
      expect(command).toContain('[ -n "$OPENCODE" ] || [ -n "$OPENCODE_CLIENT" ] || ');
    }
  });

  it("registers the UserPromptSubmit hook for raw user prompt capture", () => {
    const commands = loadHookCommands();

    expect(commands.some((command) => command.includes(".claude/hooks/user_prompt.py"))).toBe(true);
  });

  it("does not auto-complete the task from the Claude Stop hook", () => {
    const filePath = path.join(repoRootPath(), ".claude/hooks/session_stop.py");
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain('"/api/runtime-session-end"');
    expect(source).not.toMatch(/"completeTask"\s*:\s*True/);
  });
});
