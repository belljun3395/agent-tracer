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

function loadHookCommands(): string[] {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(testDir, "../../..");
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
});
