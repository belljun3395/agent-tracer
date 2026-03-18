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

function normalizeHookCommand(command: string): string {
  return command
    .replaceAll(repoRoot, "<repo>")
    .replace(/node\s+"\$CLAUDE_PROJECT_DIR\/node_modules\/tsx\/dist\/cli\.mjs"\s+"\$CLAUDE_PROJECT_DIR\/\.claude\/hooks\/([^"]+)"/g, "node node_modules/tsx/dist/cli.mjs .claude/hooks/$1")
    .replace(/node\s+"?<repo>\/node_modules\/tsx\/dist\/cli\.mjs"?\s+"?<repo>\/\.claude\/hooks\/([^"\s]+)"?/g, "node node_modules/tsx/dist/cli.mjs .claude/hooks/$1")
    .replace(/node\s+"?node_modules\/tsx\/dist\/cli\.mjs"?\s+"?\.claude\/hooks\/([^"\s]+)"?/g, "node node_modules/tsx/dist/cli.mjs .claude/hooks/$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHookEntries(entries: unknown): HookEntry[] {
  const list = Array.isArray(entries) ? entries : [];
  return list
    .map((entry) => entry as HookEntry)
    .map((entry) => ({
      ...(entry.matcher ? { matcher: entry.matcher } : {}),
      hooks: (Array.isArray(entry.hooks) ? entry.hooks : [])
        .map((hook) => ({
          type: hook.type,
          command: hook.command ? normalizeHookCommand(hook.command) : hook.command
        }))
    }))
    .sort((left, right) => (left.matcher ?? "").localeCompare(right.matcher ?? ""));
}

describe("setup:external Claude integration", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("generates Claude hook settings with repo-local parity", async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-setup-"));
    tempDirs.push(targetDir);

    await execFileAsync(process.execPath, [
      setupExternalScript,
      "--target",
      targetDir,
      "--mode",
      "claude"
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

    expect(Object.keys(generatedHooks).sort()).toEqual(Object.keys(repoHooks).sort());
    expect(normalizeHookEntries(generatedHooks.PostToolUse)).toEqual(
      normalizeHookEntries(repoHooks.PostToolUse)
    );
    expect(normalizeHookEntries(generatedHooks.SessionStart)).toEqual(
      normalizeHookEntries(repoHooks.SessionStart)
    );
    expect(normalizeHookEntries(generatedHooks.UserPromptSubmit)).toEqual(
      normalizeHookEntries(repoHooks.UserPromptSubmit)
    );
    expect(normalizeHookEntries(generatedHooks.PreToolUse)).toEqual(
      normalizeHookEntries(repoHooks.PreToolUse)
    );
    expect(generatedHooks).not.toHaveProperty("Stop");
    expect(repoHooks).not.toHaveProperty("Stop");
    expect(normalizeHookEntries(generatedHooks.PostToolUseFailure)).toEqual(
      normalizeHookEntries(repoHooks.PostToolUseFailure)
    );
    expect(normalizeHookEntries(generatedHooks.SubagentStart)).toEqual(
      normalizeHookEntries(repoHooks.SubagentStart)
    );
    expect(normalizeHookEntries(generatedHooks.SubagentStop)).toEqual(
      normalizeHookEntries(repoHooks.SubagentStop)
    );
    expect(normalizeHookEntries(generatedHooks.PreCompact)).toEqual(
      normalizeHookEntries(repoHooks.PreCompact)
    );
    expect(normalizeHookEntries(generatedHooks.PostCompact)).toEqual(
      normalizeHookEntries(repoHooks.PostCompact)
    );
    expect(normalizeHookEntries(generatedHooks.SessionEnd)).toEqual(
      normalizeHookEntries(repoHooks.SessionEnd)
    );

    const postToolMatchers = normalizeHookEntries(generatedHooks.PostToolUse)
      .map((entry) => entry.matcher ?? "");
    expect(postToolMatchers).toContain("Read|Glob|Grep|WebSearch|WebFetch");
    expect(postToolMatchers).not.toContain("Read|Glob|Grep|LS|WebSearch|WebFetch");
    expect(postToolMatchers).toContain("TaskCreate|TaskUpdate|TodoWrite");
    expect(postToolMatchers).toContain("mcp__.*");

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
      expect(command.includes("OPENCODE")).toBe(false);
      expect(command.includes("git rev-parse")).toBe(false);
    }
  });
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
      "opencode"
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

    expect(generatedOpencodeConfig.plugin).toEqual(
      expect.arrayContaining([".opencode/plugins/monitor.ts"])
    );
    expect(generatedOpencodeConfig.mcp?.monitor).toEqual(expect.objectContaining({
      type: "local",
      enabled: true
    }));
    expect(pluginShim).toContain("export { MonitorPlugin as default }");
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
      "codex"
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
    expect(generatedSkill).toEqual(repoSkill);
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
