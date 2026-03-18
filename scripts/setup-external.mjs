#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SKILL_PROJECTION_BANNER = "<!-- GENERATED FILE: edit skills/... source, then run node scripts/sync-skill-projections.mjs -->\n\n";
const CODEX_AGENTS_BEGIN = "<!-- BEGIN agent-tracer codex-monitor -->";
const CODEX_AGENTS_END = "<!-- END agent-tracer codex-monitor -->";

function parseArgs(argv) {
  const args = {
    target: "",
    monitorBaseUrl: process.env.MONITOR_BASE_URL || "http://127.0.0.1:3847",
    mode: "both"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--target") {
      args.target = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (token === "--monitor-base-url") {
      args.monitorBaseUrl = String(argv[index + 1] || "").trim() || args.monitorBaseUrl;
      index += 1;
      continue;
    }
    if (token === "--mode") {
      const mode = String(argv[index + 1] || "").trim();
      if (mode === "opencode" || mode === "claude" || mode === "codex" || mode === "both") {
        args.mode = mode;
      }
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
    }
  }

  return args;
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(filePath, next, "utf8");
}

const OPENCODE_TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    module: "ESNext",
    moduleResolution: "Bundler",
    resolveJsonModule: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    strict: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    exactOptionalPropertyTypes: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    noEmit: true,
    types: ["node"]
  },
  include: ["plugins/**/*.ts"]
};

function ensureHookEntry(list, command, matcher) {
  const entries = Array.isArray(list) ? [...list] : [];
  const duplicate = entries.some((entry) => {
    const hooks = Array.isArray(entry?.hooks) ? entry.hooks : [];
    return (entry?.matcher ?? "") === (matcher ?? "")
      && hooks.some((hook) => hook?.type === "command" && hook?.command === command);
  });
  if (duplicate) return entries;

  const next = {
    ...(matcher ? { matcher } : {}),
    hooks: [{ type: "command", command }]
  };
  entries.push(next);
  return entries;
}

function hookCommand(tracerRoot, scriptPath) {
  const tsxPath = path.join(tracerRoot, "node_modules", "tsx", "dist", "cli.mjs");
  return `node ${JSON.stringify(tsxPath)} ${JSON.stringify(scriptPath)}`;
}

function generatedSkillContent(sourceContent) {
  return `${SKILL_PROJECTION_BANNER}${sourceContent}`;
}

function buildCodexAgentsBlock() {
  return [
    CODEX_AGENTS_BEGIN,
    "## Agent Tracer",
    "",
    "### Available skills",
    "",
    "- codex-monitor: Agent Tracer monitoring workflow for Codex. (file: .agents/skills/codex-monitor/SKILL.md)",
    "",
    "### How to use skills",
    "",
    "- Codex CLI -> `codex-monitor` 스킬 사용",
    "- 실질적 작업 전에 스킬 파일을 열고 흐름을 따름",
    "- monitor-server MCP 서버 미가용 시 작업 계속 후 마지막에 gap 리포트",
    "",
    "### Canonical user.message path",
    "",
    "- `monitor_user_message` (`captureMode=\"raw\"`) 로 실제 사용자 프롬프트 기록",
    "- `monitor_save_context`는 raw 프롬프트가 아닌 계획·체크포인트 전용",
    "- `monitor_session_end`는 세션만 종료; 작업 종료는 `monitor_task_complete`만 사용",
    CODEX_AGENTS_END,
    ""
  ].join("\n");
}

function upsertManagedBlock(currentContent, block, beginMarker, endMarker) {
  const trimmedBlock = block.trimEnd();
  if (!currentContent.trim()) {
    return `${trimmedBlock}\n`;
  }

  const beginIndex = currentContent.indexOf(beginMarker);
  const endIndex = currentContent.indexOf(endMarker);
  if (beginIndex !== -1 && endIndex !== -1 && endIndex >= beginIndex) {
    const afterEnd = endIndex + endMarker.length;
    const before = currentContent.slice(0, beginIndex).replace(/\s*$/, "");
    const after = currentContent.slice(afterEnd).replace(/^\s*/, "");
    return [
      before,
      "",
      trimmedBlock,
      after ? `\n${after}` : ""
    ].join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "\n");
  }

  return `${currentContent.replace(/\s*$/, "")}\n\n${trimmedBlock}\n`;
}

const CLAUDE_HOOK_SPECS = [
  { event: "SessionStart", script: "session_start.ts", matcher: "startup|resume|clear" },
  { event: "UserPromptSubmit", script: "user_prompt.ts" },
  { event: "PreToolUse", script: "ensure_task.ts" },
  { event: "PostToolUse", script: "terminal.ts", matcher: "Bash" },
  { event: "PostToolUse", script: "tool_used.ts", matcher: "Edit|Write" },
  { event: "PostToolUse", script: "explore.ts", matcher: "Read|Glob|Grep|WebSearch|WebFetch" },
  { event: "PostToolUse", script: "agent_activity.ts", matcher: "Agent|Skill" },
  { event: "PostToolUse", script: "todo.ts", matcher: "TaskCreate|TaskUpdate|TodoWrite" },
  { event: "PostToolUse", script: "tool_used.ts", matcher: "mcp__.*" },
  { event: "PostToolUseFailure", script: "tool_used.ts", matcher: "Bash|Edit|Write|Agent|Skill|TaskCreate|TaskUpdate|TodoWrite|mcp__.*" },
  { event: "SubagentStart", script: "subagent_lifecycle.ts" },
  { event: "SubagentStop", script: "subagent_lifecycle.ts" },
  { event: "PreCompact", script: "compact.ts" },
  { event: "PostCompact", script: "compact.ts" },
  { event: "SessionEnd", script: "session_end.ts" }
];

async function setupOpenCode({ targetDir, tracerRoot, monitorBaseUrl }) {
  const opencodePath = path.join(targetDir, "opencode.json");
  const opencodeTsconfigPath = path.join(targetDir, ".opencode", "tsconfig.json");
  const pluginDir = path.join(targetDir, ".opencode", "plugins");
  const pluginShimPath = path.join(pluginDir, "monitor.ts");
  const mcpEntryPath = path.join(tracerRoot, "packages", "mcp", "dist", "index.js");
  const pluginSourcePath = path.join(tracerRoot, ".opencode", "plugins", "monitor.ts");

  await mkdir(pluginDir, { recursive: true });

  const existing = await readJson(opencodePath, {});
  const next = {
    ...existing,
    $schema: existing.$schema || "https://opencode.ai/config.json",
    mcp: {
      ...(existing.mcp || {}),
      monitor: {
        type: "local",
        command: ["node", mcpEntryPath],
        enabled: true,
        environment: {
          MONITOR_BASE_URL: monitorBaseUrl
        }
      }
    }
  };

  const existingPlugins = Array.isArray(existing.plugin) ? existing.plugin : [];
  const pluginRef = ".opencode/plugins/monitor.ts";
  if (!existingPlugins.includes(pluginRef)) {
    next.plugin = [...existingPlugins, pluginRef];
  }

  await writeJson(opencodePath, next);

  const shim = [
    "// Auto-generated by agent-tracer/scripts/setup-external.mjs",
    `export { MonitorPlugin as default } from ${JSON.stringify(pluginSourcePath)};`,
    ""
  ].join("\n");
  await writeFile(pluginShimPath, shim, "utf8");
  await writeJson(opencodeTsconfigPath, OPENCODE_TSCONFIG);
}

async function setupClaude({ targetDir, tracerRoot }) {
  const settingsPath = path.join(targetDir, ".claude", "settings.json");
  await mkdir(path.dirname(settingsPath), { recursive: true });

  const settings = await readJson(settingsPath, {});
  const hooks = settings.hooks && typeof settings.hooks === "object" ? { ...settings.hooks } : {};
  const hookRoot = path.join(tracerRoot, ".claude", "hooks");
  const command = (scriptName) => hookCommand(tracerRoot, path.join(hookRoot, scriptName));

  delete hooks.Stop;
  for (const spec of CLAUDE_HOOK_SPECS) {
    hooks[spec.event] = ensureHookEntry(
      hooks[spec.event],
      command(spec.script),
      spec.matcher
    );
  }

  await writeJson(settingsPath, {
    ...settings,
    hooks
  });
}

async function setupCodex({ targetDir, tracerRoot }) {
  const agentsPath = path.join(targetDir, "AGENTS.md");
  const codexSkillSourcePath = path.join(tracerRoot, "skills", "codex-monitor", "SKILL.md");
  const codexSkillTargetPath = path.join(targetDir, ".agents", "skills", "codex-monitor", "SKILL.md");

  await mkdir(path.dirname(codexSkillTargetPath), { recursive: true });

  const sourceSkill = await readFile(codexSkillSourcePath, "utf8");
  await writeFile(codexSkillTargetPath, generatedSkillContent(sourceSkill), "utf8");

  let existingAgents = "";
  try {
    existingAgents = await readFile(agentsPath, "utf8");
  } catch {
    existingAgents = "";
  }

  const nextAgents = upsertManagedBlock(
    existingAgents,
    buildCodexAgentsBlock(),
    CODEX_AGENTS_BEGIN,
    CODEX_AGENTS_END
  );

  await writeFile(agentsPath, nextAgents, "utf8");
}

function printHelp() {
  process.stdout.write(
    [
      "Usage:",
      "  npm run setup:external -- --target /path/to/your-project [--mode both|opencode|claude|codex] [--monitor-base-url http://127.0.0.1:3847]",
      "",
      "Examples:",
      "  npm run setup:external -- --target ../my-app",
      "  npm run setup:external -- --target ../my-app --mode opencode",
      "  npm run setup:external -- --target ../my-app --mode codex",
      ""
    ].join("\n")
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.target) {
    throw new Error("Missing required --target option");
  }

  const tracerRoot = process.cwd();
  const targetDir = path.resolve(args.target);

  if (args.mode === "both" || args.mode === "opencode") {
    await setupOpenCode({
      targetDir,
      tracerRoot,
      monitorBaseUrl: args.monitorBaseUrl
    });
  }

  if (args.mode === "both" || args.mode === "claude") {
    await setupClaude({
      targetDir,
      tracerRoot
    });
  }

  if (args.mode === "codex") {
    await setupCodex({
      targetDir,
      tracerRoot
    });
  }

  process.stdout.write(
    `Configured ${args.mode} monitor integration in ${targetDir}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
