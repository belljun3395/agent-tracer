/**
 * @module application/workflow-context-builder
 *
 * 타임라인 이벤트로부터 서버사이드 워크플로우 컨텍스트 마크다운을 생성.
 * 웹 프론트엔드의 buildHandoffMarkdown과 유사하나 제한 없이 전체 이벤트를 포함.
 */

import type { TimelineEvent } from "@monitor/core";

const LANE_TITLES: Record<string, string> = {
  user: "User Interactions",
  exploration: "Exploration",
  planning: "Planning",
  implementation: "Implementation",
  questions: "Questions",
  todos: "TODOs",
  background: "Background",
  coordination: "Coordination"
};

export function buildWorkflowContext(events: readonly TimelineEvent[], taskTitle: string): string {
  const parts: string[] = [`# Workflow: ${taskTitle}`];

  // 원래 요청 (첫 번째 user.message 이벤트)
  const firstUserMsg = events.find(e => e.kind === "user.message");
  if (firstUserMsg) {
    const text = firstUserMsg.body || firstUserMsg.title;
    parts.push(`\n## Original Request\n${text}`);
  }

  // 플랜 단계 (planning 레인 이벤트)
  const planEvents = events.filter(e => e.lane === "planning");
  if (planEvents.length > 0) {
    parts.push(`\n## Plan\n${planEvents.map(e => `- ${e.title}`).join("\n")}`);
  }

  // 레인별 프로세스 (truncation 없이 전체)
  const lanes = ["exploration", "implementation", "questions", "todos", "background", "coordination"] as const;
  for (const lane of lanes) {
    const laneEvents = events.filter(e => e.lane === lane);
    if (laneEvents.length === 0) continue;
    const title = LANE_TITLES[lane] ?? lane;
    parts.push(`\n## ${title}\n${laneEvents.map(e => `- ${e.title}`).join("\n")}`);
  }

  // 수정된 파일 (file.changed 이벤트, writeCount > 0)
  const modifiedFiles = [...new Set(
    events
      .filter(e => e.kind === "file.changed" && (e.metadata["writeCount"] as number | undefined ?? 0) > 0)
      .map(e => e.metadata["filePath"] as string | undefined ?? e.title)
      .filter(Boolean)
  )];
  if (modifiedFiles.length > 0) {
    parts.push(`\n## Modified Files\n${modifiedFiles.map(f => `- \`${f}\``).join("\n")}`);
  }

  const openTodos = events
    .filter(e => e.kind === "todo.logged")
    .filter(e => {
      const state = e.metadata["todoState"] as string | undefined;
      return state !== "completed" && state !== "cancelled";
    });
  const latestTodoByTitle = new Map<string, string>();
  for (const e of openTodos) {
    latestTodoByTitle.set(e.title, e.metadata["todoState"] as string ?? "added");
  }
  const openTodoTitles = [...latestTodoByTitle.entries()]
    .filter(([, state]) => state !== "completed" && state !== "cancelled")
    .map(([title]) => title);
  if (openTodoTitles.length > 0) {
    parts.push(`\n## Open TODOs\n${openTodoTitles.map(t => `- ${t}`).join("\n")}`);
  }

  // 검증 결과 요약
  const verifications = events.filter(e => e.kind === "verification.logged" || e.kind === "rule.logged");
  if (verifications.length > 0) {
    const failCount = verifications.filter(e =>
      e.metadata["verificationStatus"] === "fail" || e.metadata["ruleStatus"] === "violation"
    ).length;
    const passCount = verifications.length - failCount;
    parts.push(`\n## Verification Summary\n- Checks: ${verifications.length} (${passCount} pass, ${failCount} fail)`);
    const violations = verifications.filter(e =>
      e.metadata["verificationStatus"] === "fail" || e.metadata["ruleStatus"] === "violation"
    );
    if (violations.length > 0) {
      parts.push(violations.map(e => `- [FAIL] ${e.title}`).join("\n"));
    }
  }

  return parts.join("");
}
