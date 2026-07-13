#!/usr/bin/env node
// 커밋 훅과 CI가 함께 쓰는 커밋 메시지 검사기다.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TYPES = ["feat", "fix", "refactor", "test", "docs", "chore", "ci"];
const SCOPES = [
  "kernel", "runtime", "web", "agents",
  "runtime-api", "tracer-api", "projector", "ai-agent-worker",
  "platform", "tracer-domain",
  "server", "infra", "ci", "docs", "repo", "scripts",
];
const HEADER_PATTERN = /^(\w+)(?:\(([\w-]+)\))?: (.+)$/;
const KOREAN_PATTERN = /[가-힣]/;
// 명사구 제목을 막고 행위 문장을 강제한다.
const ACTION_SENTENCE_PATTERN = /다$/;
const TRAILER_PATTERN = /^[A-Za-z-]+:\s*\S+@|^Co-authored-by:/i;
// 근거와 검증을 정형 블록으로 나열하던 관습을 막는다.
const BANNED_BODY_PREFIXES = [
  "Constraint:", "Rejected:", "Confidence:", "Scope-risk:",
  "Reversibility:", "Directive:", "Tested:", "Not-tested:",
];
const MAX_TITLE_LENGTH = 60;
const MAX_BODY_LINES = 4;

/** 커밋 메시지 한 건을 검사해 위반 목록을 낸다. */
export function checkCommitMessage(message) {
  const lines = message.split("\n");
  const subject = lines[0]?.trimEnd() ?? "";

  if (subject.startsWith("Merge ") || subject.startsWith("Revert ")) return [];

  const errors = [];
  const match = subject.match(HEADER_PATTERN);
  if (!match) {
    return [`형식이 "타입(범위): 제목"이 아니다: "${subject}"`];
  }

  const [, type, scope, title] = match;
  if (!TYPES.includes(type)) {
    errors.push(`타입 "${type}"은 허용 목록에 없다: ${TYPES.join(", ")}`);
  }
  if (scope !== undefined && !SCOPES.includes(scope)) {
    errors.push(`범위 "${scope}"는 허용 목록에 없다: ${SCOPES.join(", ")}`);
  }
  if (!KOREAN_PATTERN.test(title)) {
    errors.push(`제목은 한글로 쓴다: "${title}"`);
  }
  if (title.endsWith(".")) {
    errors.push(`제목 끝에 마침표를 쓰지 않는다: "${title}"`);
  }
  if (title.length > MAX_TITLE_LENGTH) {
    errors.push(`제목이 ${MAX_TITLE_LENGTH}자를 넘는다(${title.length}자): "${title}"`);
  }
  if (!ACTION_SENTENCE_PATTERN.test(title)) {
    errors.push(`제목은 행위 문장으로 쓴다("…한다"): "${title}"`);
  }

  errors.push(...checkBody(lines.slice(1)));
  return errors;
}

function checkBody(bodyLines) {
  const errors = [];
  const content = bodyLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !TRAILER_PATTERN.test(line));

  const banned = content
    .flatMap((line) => BANNED_BODY_PREFIXES.filter((prefix) => line.startsWith(prefix)))
    .at(0);
  if (banned) {
    errors.push(`본문에 정형 블록 "${banned}"을 쓰지 않는다`);
  }
  if (content.length > MAX_BODY_LINES) {
    errors.push(`본문이 ${MAX_BODY_LINES}줄을 넘는다(${content.length}줄)`);
  }

  return errors;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("사용: node scripts/check-commit-msg.mjs <커밋-메시지-파일>");
    process.exit(2);
  }
  const errors = checkCommitMessage(fs.readFileSync(filePath, "utf8"));
  if (errors.length > 0) {
    console.error("커밋 메시지가 규칙을 위반한다.\n");
    for (const error of errors) console.error(`  ✗ ${error}`);
    console.error('\n형식: 타입(범위): 한글 제목    예) fix(runtime): 세션 바인딩 락 경합을 없앤다');
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
