#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const banner = "<!-- GENERATED FILE: edit skills/... source, then run node scripts/sync-skill-projections.mjs -->\n\n";

const projections = [
  {
    source: "skills/codex-monitor/SKILL.md",
    target: ".agents/skills/codex-monitor/SKILL.md"
  },
  {
    source: "skills/monitor/SKILL.md",
    target: ".agents/skills/monitor/SKILL.md"
  },
  {
    source: "skills/monitor/SKILL.md",
    target: ".claude/skills/agent-tracer-monitor/SKILL.md"
  }
];

function parseArgs(argv) {
  return {
    check: argv.includes("--check")
  };
}

function resolveRepoPath(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

async function syncProjection(projection, check) {
  const sourcePath = resolveRepoPath(projection.source);
  const targetPath = resolveRepoPath(projection.target);
  const sourceContent = await readFile(sourcePath, "utf8");
  const nextContent = `${banner}${sourceContent}`;

  let currentContent = "";
  try {
    currentContent = await readFile(targetPath, "utf8");
  } catch {
    currentContent = "";
  }

  if (check) {
    if (currentContent !== nextContent) {
      throw new Error(`Projection drift detected: ${projection.target}`);
    }
    return;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, nextContent, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  for (const projection of projections) {
    await syncProjection(projection, args.check);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
