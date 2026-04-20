#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

// Inline config helpers — setup-external.mjs runs as plain Node.js without tsx
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function readYamlFile(p) {
  if (!fs.existsSync(p)) return {};
  const raw = fs.readFileSync(p, "utf8");
  const parsed = parse(raw) ?? {};
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
}
function trimString(v) { return typeof v === "string" ? v.trim() : ""; }
function normalizeBaseUrl(v) { const n = trimString(v); return n ? n.replace(/\/+$/g, "") : ""; }
const _yaml = Object.assign(
  readYamlFile(path.join(REPO_ROOT, "application.yaml")),
  readYamlFile(path.join(REPO_ROOT, "application.local.yaml"))
);
const APPLICATION_CONFIG = {
  monitor: {
    protocol: trimString(_yaml.monitor?.protocol) || "http",
    publicHost: trimString(_yaml.monitor?.publicHost) || "127.0.0.1",
    port: Number(_yaml.monitor?.port) || 3847,
  },
  externalSetup: {
    monitorBaseUrl: normalizeBaseUrl(_yaml.externalSetup?.monitorBaseUrl),
    sourceRepo: trimString(_yaml.externalSetup?.sourceRepo) || "belljun3395/agent-tracer",
  },
};
function resolveExternalMonitorBaseUrl(config, env) {
  return normalizeBaseUrl(env.MONITOR_BASE_URL)
    || config.externalSetup.monitorBaseUrl
    || `${config.monitor.protocol}://${config.monitor.publicHost}:${config.monitor.port}`;
}
function resolveExternalSourceRepo(config, env) {
  return trimString(env.AGENT_TRACER_SOURCE_REPO) || config.externalSetup.sourceRepo;
}

const DEFAULT_SOURCE_REPO = resolveExternalSourceRepo(APPLICATION_CONFIG, process.env);

function resolveDefaultSourceRef() {
  const explicitRef = String(process.env.AGENT_TRACER_SOURCE_REF || "").trim();
  if (explicitRef) return explicitRef;

  try {
    const gitHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    if (gitHead) return gitHead;
  } catch {
    // Fall through to the branch-based default below.
  }

  return "main";
}

const DEFAULT_SOURCE_REF = resolveDefaultSourceRef();

function parseArgs(argv) {
  const args = {
    target: "",
    monitorBaseUrl: resolveExternalMonitorBaseUrl(APPLICATION_CONFIG, process.env),
    sourceRepo: DEFAULT_SOURCE_REPO,
    sourceRef: DEFAULT_SOURCE_REF,
    sourceRoot: process.env.AGENT_TRACER_SOURCE_ROOT || ""
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
    if (token === "--source-repo") {
      args.sourceRepo = String(argv[index + 1] || "").trim() || args.sourceRepo;
      index += 1;
      continue;
    }
    if (token === "--source-ref") {
      args.sourceRef = String(argv[index + 1] || "").trim() || args.sourceRef;
      index += 1;
      continue;
    }
    if (token === "--source-root") {
      args.sourceRoot = String(argv[index + 1] || "").trim() || args.sourceRoot;
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

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

const CLAUDE_PERMISSION_DEFAULTS = {
  defaultMode: "acceptEdits",
  allow: ["WebSearch", "WebFetch"]
};

async function setupClaude({ targetDir, tracerRoot }) {
  const settingsPath = path.join(targetDir, ".claude", "settings.json");
  await mkdir(path.dirname(settingsPath), { recursive: true });

  const settings = await readJson(settingsPath, {});
  // Strip any legacy hooks / statusLine blocks — the plugin (registered below) now owns
  // hook and statusLine registration via ${CLAUDE_PLUGIN_ROOT}. Leaving stale entries
  // here would double-fire events or point at stale absolute paths after a repo move.
  const { hooks: _legacyHooks, statusLine: _legacyStatusLine, ...settingsWithoutHooks } = settings;
  void _legacyHooks;
  void _legacyStatusLine;
  await writeJson(settingsPath, {
    ...settingsWithoutHooks,
    permissions: {
      ...CLAUDE_PERMISSION_DEFAULTS,
      ...(settings.permissions || {})
    }
  });

  const pluginPath = path.join(tracerRoot, "packages", "runtime", "src", "claude-code");
  process.stdout.write(
    [
      "",
      `[claude] Plugin path: ${pluginPath}`,
      `[claude] Run Claude Code with: claude --plugin-dir ${pluginPath}`,
      `[claude] Or alias it: alias claude='claude --plugin-dir ${pluginPath}'`,
      ""
    ].join("\n")
  );
}

async function writeCodexConfig({ targetDir }) {
  const codexConfigPath = path.join(targetDir, ".codex", "config.toml");
  const existing = fs.existsSync(codexConfigPath)
    ? await readFile(codexConfigPath, "utf8")
    : "";

  const next = upsertTomlBooleanSetting(existing, "features", "codex_hooks", true);
  await writeFile(codexConfigPath, next, "utf8");
  return codexConfigPath;
}

function upsertTomlBooleanSetting(raw, tableName, key, value) {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const tableHeader = new RegExp(`^\\s*\\[${escapeRegExp(tableName)}\\]\\s*$`);
  const anyTableHeader = /^\s*\[[^\]]+\]\s*$/;
  const keyLine = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  const rendered = `${key} = ${value ? "true" : "false"}`;

  const tableIndex = lines.findIndex((line) => tableHeader.test(line));

  if (tableIndex === -1) {
    const prefix = normalized.trimEnd();
    return `${prefix}${prefix ? "\n\n" : ""}[${tableName}]\n${rendered}\n`;
  }

  let tableEnd = lines.length;
  for (let index = tableIndex + 1; index < lines.length; index += 1) {
    if (anyTableHeader.test(lines[index])) {
      tableEnd = index;
      break;
    }
  }

  for (let index = tableIndex + 1; index < tableEnd; index += 1) {
    if (keyLine.test(lines[index])) {
      lines[index] = rendered;
      return `${lines.join("\n").replace(/\n*$/g, "")}\n`;
    }
  }

  lines.splice(tableEnd, 0, rendered);
  return `${lines.join("\n").replace(/\n*$/g, "")}\n`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCodexHookConfig({ tracerRoot, monitorBaseUrl }) {
  const runHook = path.join(tracerRoot, "packages", "runtime", "src", "codex", "bin", "run-hook.sh");
  const monitoredHookCommand = (hookName) =>
    `MONITOR_BASE_URL=${shQuote(monitorBaseUrl)} /usr/bin/env bash ${shQuote(runHook)} ${shQuote(hookName)}`;

  return {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [{ type: "command", command: monitoredHookCommand("SessionStart") }]
        }
      ],
      UserPromptSubmit: [
        {
          hooks: [{ type: "command", command: monitoredHookCommand("UserPromptSubmit") }]
        }
      ],
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: monitoredHookCommand("PreToolUse") }]
        }
      ],
      PostToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: monitoredHookCommand("PostToolUse/Bash") }]
        }
      ],
      Stop: [
        {
          hooks: [{ type: "command", command: monitoredHookCommand("Stop") }]
        }
      ]
    }
  };
}

function mergeCodexHookConfig(existingConfig, generatedConfig) {
  const existingHooks = existingConfig && typeof existingConfig === "object" && existingConfig !== null
    ? (existingConfig.hooks && typeof existingConfig.hooks === "object" ? existingConfig.hooks : {})
    : {};

  const mergedHooks = { ...existingHooks };

  for (const [eventName, generatedGroups] of Object.entries(generatedConfig.hooks)) {
    const priorGroups = Array.isArray(existingHooks[eventName]) ? existingHooks[eventName] : [];
    const seen = new Set(priorGroups.map((group) => JSON.stringify(group)));
    const nextGroups = [...priorGroups];
    for (const group of generatedGroups) {
      const signature = JSON.stringify(group);
      if (seen.has(signature)) continue;
      nextGroups.push(group);
      seen.add(signature);
    }
    mergedHooks[eventName] = nextGroups;
  }

  return {
    ...(existingConfig && typeof existingConfig === "object" && existingConfig !== null ? existingConfig : {}),
    hooks: mergedHooks
  };
}

async function setupCodex({ targetDir, tracerRoot, monitorBaseUrl }) {
  const codexDir = path.join(targetDir, ".codex");
  const codexHooksPath = path.join(codexDir, "hooks.json");

  await mkdir(codexDir, { recursive: true });
  const codexConfigPath = await writeCodexConfig({ targetDir });

  const existingHooks = await readJson(codexHooksPath, {});
  const generatedHooks = buildCodexHookConfig({ tracerRoot, monitorBaseUrl });
  const mergedHooks = mergeCodexHookConfig(existingHooks, generatedHooks);
  await writeJson(codexHooksPath, mergedHooks);
  await rm(path.join(codexDir, "agent-tracer"), { recursive: true, force: true });

  process.stdout.write(
    [
      "",
      `[codex] Config path: ${codexConfigPath}`,
      `[codex] Hooks config: ${codexHooksPath}`,
      `[codex] Run plain Codex in the target project: (cd ${targetDir} && codex)`,
      ""
    ].join("\n")
  );
}

function printHelp() {
  process.stdout.write(
    [
      "Usage:",
      "  npm run setup:external -- --target /path/to/your-project [--monitor-base-url http://host:port] [--source-repo owner/repo] [--source-ref main] [--source-root /local/agent-tracer]",
      "",
      "Examples:",
      "  npm run setup:external -- --target ../my-app",
      "  npm run setup:external -- --target ../my-app --source-ref main",
      "",
      "Default source ref: AGENT_TRACER_SOURCE_REF, otherwise current git HEAD when available, otherwise main.",
      "Use --source-root to vendor from a local checkout without remote fetching.",
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

  await setupClaude({ targetDir, tracerRoot });
  await setupCodex({ targetDir, tracerRoot, monitorBaseUrl: args.monitorBaseUrl });

  process.stdout.write(
    `Configured Agent Tracer external integration in ${targetDir} (source: ${args.sourceRepo}@${args.sourceRef}${args.sourceRoot ? `, sourceRoot=${args.sourceRoot}` : ""})\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
