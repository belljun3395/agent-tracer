#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadApplicationConfig, resolveExternalMonitorBaseUrl, resolveExternalSourceRepo } from "../config/load-application-config.js";

const APPLICATION_CONFIG = loadApplicationConfig({ env: process.env });
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

const CLAUDE_PERMISSION_DEFAULTS = {
  defaultMode: "acceptEdits",
  allow: ["WebSearch", "WebFetch"]
};

async function setupClaude({ targetDir, tracerRoot }) {
  const settingsPath = path.join(targetDir, ".claude", "settings.json");
  await mkdir(path.dirname(settingsPath), { recursive: true });

  const settings = await readJson(settingsPath, {});
  // Strip any legacy hooks block — the plugin (registered below) now owns hook
  // registration. Leaving stale entries here would double-fire each event.
  const { hooks: _legacyHooks, ...settingsWithoutHooks } = settings;
  void _legacyHooks;
  await writeJson(settingsPath, {
    ...settingsWithoutHooks,
    permissions: {
      ...CLAUDE_PERMISSION_DEFAULTS,
      ...(settings.permissions || {})
    }
  });

  const pluginPath = path.join(tracerRoot, "packages", "runtime-claude");
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

  process.stdout.write(
    `Configured Claude monitor integration in ${targetDir} (source: ${args.sourceRepo}@${args.sourceRef}${args.sourceRoot ? `, sourceRoot=${args.sourceRoot}` : ""})\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
