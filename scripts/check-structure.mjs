#!/usr/bin/env node
// 상한은 매니페스트가 소유하고 전부 0이므로 예산 파일도 백로그도 두지 않는다.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BUDGETS } from "../architecture.manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_ROOT = path.join(ROOT, "packages");
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".venv", "__pycache__"]);
const SOURCE = /\.(?:ts|tsx|py)$/;
const TEST = /\.(?:test|spec)\.tsx?$|(?:^|\/)test_[^/]+\.py$/;
const DECLARATION = /\.d\.ts$/;

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

/** 300줄을 넘는 파일은 책임이 여럿이라는 신호다. */
export function findOversized(files, maxLines) {
  return files
    .filter((file) => SOURCE.test(file) && !TEST.test(file) && !DECLARATION.test(file))
    .map((file) => ({ file, lines: fs.readFileSync(file, "utf8").split("\n").length }))
    .filter((candidate) => candidate.lines > maxLines)
    .sort((left, right) => right.lines - left.lines);
}

/** 유스케이스는 예외 없이 인접 테스트를 갖는다. */
export function findUntestedUsecases(files) {
  return files
    .filter((file) => file.endsWith(".usecase.ts"))
    .filter((file) => !fs.existsSync(file.replace(/\.ts$/, ".test.ts")))
    .map((file) => ({ file }));
}

function linksToClaudeDoc(sibling) {
  try {
    return fs.lstatSync(sibling).isSymbolicLink() && fs.readlinkSync(sibling) === "CLAUDE.md";
  } catch {
    return false;
  }
}

/** 두 도구가 같은 지침을 읽도록 CLAUDE.md 옆에는 AGENTS.md 링크가 선다. */
export function findUnlinkedAgentDocs(files) {
  return files
    .filter((file) => path.basename(file) === "CLAUDE.md")
    .filter((file) => !linksToClaudeDoc(path.join(path.dirname(file), "AGENTS.md")))
    .map((file) => ({ file }));
}

function main() {
  const scanned = fs.existsSync(SCAN_ROOT) ? walk(SCAN_ROOT) : [];
  const files = [...scanned, path.join(ROOT, "CLAUDE.md")];
  const metrics = {
    oversizedFiles: findOversized(files, BUDGETS.maxFileLines),
    untestedUsecases: findUntestedUsecases(files),
    unlinkedAgentDocs: findUnlinkedAgentDocs(files),
  };

  const violations = Object.entries(metrics).filter(
    ([key, offenders]) => offenders.length > BUDGETS[key],
  );

  if (violations.length > 0) {
    console.error("구조 상한을 넘었다.\n");
    for (const [key, offenders] of violations) {
      console.error(`  ✗ ${key}: ${offenders.length}개 (상한 ${BUDGETS[key]})`);
      for (const offender of offenders) {
        const where = path.relative(ROOT, offender.file);
        console.error(`      ${where}${offender.lines ? ` (${offender.lines}줄)` : ""}`);
      }
    }
    console.error("\n상한을 올리지 않는다. 파일을 나누거나 테스트를 더한다.");
    process.exit(1);
  }

  const summary = Object.entries(metrics)
    .map(([key, offenders]) => `${key} ${offenders.length}/${BUDGETS[key]}`)
    .join(", ");
  console.log(`구조 상한 통과 (${summary})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
