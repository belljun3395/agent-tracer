#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

function parseArgs(argv) {
  const args = { target: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--target") {
      args.target = String(argv[index + 1] || "").trim();
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
  // 훅과 상태줄은 플러그인이 소유하므로 옛 항목이 남아 있으면 이벤트가 이중 발화한다.
  const {
    hooks: _legacyHooks,
    statusLine: _legacyStatusLine,
    ...settingsWithoutHooks
  } = settings;
  void _legacyHooks;
  void _legacyStatusLine;
  await writeJson(settingsPath, {
    ...settingsWithoutHooks,
    permissions: {
      ...CLAUDE_PERMISSION_DEFAULTS,
      ...(settings.permissions || {})
    }
  });

  const pluginPath = path.join(tracerRoot, "packages", "runtime");
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
      "  npm run setup:external -- --target /path/to/your-project",
      "",
      "Examples:",
      "  npm run setup:external -- --target ../my-app",
      "",
      "Configures Claude Code for the given target project.",
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
    `Configured Agent Tracer external integration in ${targetDir}\n`
  );
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
