import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const setupExternalScript = path.join(repoRoot, "scripts", "setup-external.mjs");
const repoClaudeSettingsPath = path.join(repoRoot, ".claude", "settings.json");
const repoOpenCodeTsconfigPath = path.join(repoRoot, ".opencode", "tsconfig.json");
const repoCodexSkillProjectionPath = path.join(
  repoRoot,
  ".agents",
  "skills",
  "codex-monitor",
  "SKILL.md"
);

type HookEntry = {
  readonly matcher?: string;
  readonly hooks?: Array<{ readonly type?: string; readonly command?: string }>;
};

function normalizeHookEntries(entries: unknown): HookEntry[] {
  const list = Array.isArray(entries) ? entries : [];
  return list
    .map((entry) => entry as HookEntry)
    .map((entry) => ({
      ...(entry.matcher ? { matcher: entry.matcher } : {}),
      hooks: (Array.isArray(entry.hooks) ? entry.hooks : [])
        .map((hook) => ({
          ...(hook.type ? { type: hook.type } : {}),
          ...(hook.command ? { command: hook.command } : {})
        }))
    }))
    .sort((left, right) => (left.matcher ?? "").localeCompare(right.matcher ?? ""));
}

describe("setup:external Claude integration", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("generates Claude hook settings with vendored source references", async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-setup-"));
    tempDirs.push(targetDir);

    await execFileAsync(process.execPath, [
      setupExternalScript,
      "--target",
      targetDir,
      "--mode",
      "claude",
      "--source-root",
      repoRoot
    ], {
      cwd: repoRoot
    });

    const generatedSettings = JSON.parse(
      await readFile(path.join(targetDir, ".claude", "settings.json"), "utf8")
    ) as { hooks?: Record<string, unknown> };
    const repoSettings = JSON.parse(
      await readFile(repoClaudeSettingsPath, "utf8")
    ) as { hooks?: Record<string, unknown> };

    const generatedHooks = generatedSettings.hooks ?? {};
    const repoHooks = repoSettings.hooks ?? {};

    const generatedKeys = Object.keys(generatedHooks).sort();
    const repoKeys = Object.keys(repoHooks).filter((key) => key !== "Stop").sort();
    expect(generatedKeys).toEqual(repoKeys);

    const postToolMatchers = normalizeHookEntries(generatedHooks.PostToolUse)
      .map((entry) => entry.matcher ?? "");
    const repoPostToolMatchers = normalizeHookEntries(repoHooks.PostToolUse)
      .map((entry) => entry.matcher ?? "");
    expect(postToolMatchers.sort()).toEqual(repoPostToolMatchers.sort());

    const allCommands = [
      ...normalizeHookEntries(generatedHooks.SessionStart),
      ...normalizeHookEntries(generatedHooks.UserPromptSubmit),
      ...normalizeHookEntries(generatedHooks.PreToolUse),
      ...normalizeHookEntries(generatedHooks.PostToolUse),
      ...normalizeHookEntries(generatedHooks.PostToolUseFailure),
      ...normalizeHookEntries(generatedHooks.SubagentStart),
      ...normalizeHookEntries(generatedHooks.SubagentStop),
      ...normalizeHookEntries(generatedHooks.PreCompact),
      ...normalizeHookEntries(generatedHooks.PostCompact),
      ...normalizeHookEntries(generatedHooks.SessionEnd)
    ].flatMap((entry) => entry.hooks ?? []).map((hook) => hook.command ?? "");

    expect(allCommands.length).toBeGreaterThan(0);
    for (const command of allCommands) {
      expect(command).toContain("npx --yes tsx");
      expect(command).toContain("CLAUDE_PROJECT_DIR");
      expect(command).toContain(".agent-tracer/.claude/hooks/");
      expect(command.includes(repoRoot)).toBe(false);
      expect(command).toContain("git rev-parse --show-toplevel");
    }

    const repoAllCommands = [
      ...normalizeHookEntries(repoHooks.SessionStart),
      ...normalizeHookEntries(repoHooks.UserPromptSubmit),
      ...normalizeHookEntries(repoHooks.PreToolUse),
      ...normalizeHookEntries(repoHooks.PostToolUse),
      ...normalizeHookEntries(repoHooks.PostToolUseFailure),
      ...normalizeHookEntries(repoHooks.SubagentStart),
      ...normalizeHookEntries(repoHooks.SubagentStop),
      ...normalizeHookEntries(repoHooks.PreCompact),
      ...normalizeHookEntries(repoHooks.PostCompact),
      ...normalizeHookEntries(repoHooks.SessionEnd),
      ...normalizeHookEntries(repoHooks.Stop)
    ].flatMap((entry) => entry.hooks ?? []).map((hook) => hook.command ?? "");

    expect(repoAllCommands.length).toBeGreaterThan(0);
    for (const command of repoAllCommands) {
      expect(command).toContain("git rev-parse --show-toplevel");
      expect(command).toContain(".claude/hooks/");
    }

    const vendoredCommon = await readFile(
      path.join(targetDir, ".agent-tracer", ".claude", "hooks", "common.ts"),
      "utf8"
    );
    const vendoredSessionStart = await readFile(
      path.join(targetDir, ".agent-tracer", ".claude", "hooks", "session_start.ts"),
      "utf8"
    );
    expect(vendoredCommon).toContain("ensureRuntimeSession");
    expect(vendoredSessionStart).toContain("Session started");
  }, 60_000);
});

describe("setup:external OpenCode integration", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("generates OpenCode plugin shim and local TypeScript config", async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-opencode-setup-"));
    tempDirs.push(targetDir);

    await execFileAsync(process.execPath, [
      setupExternalScript,
      "--target",
      targetDir,
      "--mode",
      "opencode",
      "--source-root",
      repoRoot
    ], {
      cwd: repoRoot
    });

    const generatedOpencodeConfig = JSON.parse(
      await readFile(path.join(targetDir, "opencode.json"), "utf8")
    ) as { plugin?: unknown; mcp?: Record<string, unknown> };
    const generatedTsconfig = JSON.parse(
      await readFile(path.join(targetDir, ".opencode", "tsconfig.json"), "utf8")
    );
    const repoTsconfig = JSON.parse(
      await readFile(repoOpenCodeTsconfigPath, "utf8")
    );
    const pluginShim = await readFile(
      path.join(targetDir, ".opencode", "plugins", "monitor.ts"),
      "utf8"
    );
    const vendoredPlugin = await readFile(
      path.join(targetDir, ".agent-tracer", ".opencode", "plugins", "monitor.ts"),
      "utf8"
    );

    expect(generatedOpencodeConfig.plugin).toEqual(
      expect.arrayContaining([".opencode/plugins/monitor.ts"])
    );
    expect(generatedOpencodeConfig.mcp?.monitor).toEqual(expect.objectContaining({
      type: "local",
      enabled: true
    }));
    const monitorConfig = generatedOpencodeConfig.mcp?.monitor as { command?: unknown } | undefined;
    expect(Array.isArray(monitorConfig?.command)).toBe(true);
    expect((monitorConfig?.command as string[])[0]).toBe("node");
    expect((monitorConfig?.command as string[])[1]).toContain("packages/mcp/dist/index.js");
    expect(pluginShim).toContain("export { MonitorPlugin as default }");
    expect(pluginShim).toContain("../../.agent-tracer/.opencode/plugins/monitor.ts");
    expect(vendoredPlugin).toContain("createMonitorHooks");
    expect(generatedTsconfig).toEqual(repoTsconfig);
  });
});

describe("setup:external Codex integration", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("generates a Codex skill projection and AGENTS instructions", async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-codex-setup-"));
    tempDirs.push(targetDir);

    await execFileAsync(process.execPath, [
      setupExternalScript,
      "--target",
      targetDir,
      "--mode",
      "codex",
      "--source-root",
      repoRoot
    ], {
      cwd: repoRoot
    });

    const generatedAgents = await readFile(path.join(targetDir, "AGENTS.md"), "utf8");
    const generatedSkill = await readFile(
      path.join(targetDir, ".agents", "skills", "codex-monitor", "SKILL.md"),
      "utf8"
    );
    const repoSkill = await readFile(repoCodexSkillProjectionPath, "utf8");

    expect(generatedAgents).toContain("codex-monitor");
    expect(generatedAgents).toContain(".agents/skills/codex-monitor/SKILL.md");
    expect(generatedAgents).toContain("monitor_user_message");
    expect(generatedAgents).toContain("monitor_runtime_session_end");
    expect(generatedSkill).toEqual(repoSkill);
    await expect(readFile(path.join(targetDir, ".codex", "config.toml"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(targetDir, ".codex", "hooks.json"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(targetDir, ".agent-tracer", ".codex", "hooks", "session_start.ts"), "utf8")).rejects.toThrow();
  });

  it("preserves existing AGENTS.md content while updating the managed Codex block", async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-codex-merge-"));
    tempDirs.push(targetDir);

    const existingAgents = [
      "# Existing Instructions",
      "",
      "Keep local conventions intact.",
      "",
      "<!-- BEGIN agent-tracer codex-monitor -->",
      "stale content",
      "<!-- END agent-tracer codex-monitor -->",
      ""
    ].join("\n");

    await writeFile(path.join(targetDir, "AGENTS.md"), existingAgents, "utf8");

    await execFileAsync(process.execPath, [
      setupExternalScript,
      "--target",
      targetDir,
      "--mode",
      "codex"
    ], {
      cwd: repoRoot
    });

    const generatedAgents = await readFile(path.join(targetDir, "AGENTS.md"), "utf8");

    expect(generatedAgents).toContain("# Existing Instructions");
    expect(generatedAgents).toContain("Keep local conventions intact.");
    expect(generatedAgents).toContain("<!-- BEGIN agent-tracer codex-monitor -->");
    expect(generatedAgents).toContain("codex-monitor");
    expect(generatedAgents).not.toContain("stale content");
    expect(generatedAgents.match(/BEGIN agent-tracer codex-monitor/g)).toHaveLength(1);
  });
});
