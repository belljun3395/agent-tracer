/**
 * @module application/workflow-context-builder
 *
 * 타임라인 이벤트로부터 서버사이드 워크플로우 컨텍스트 마크다운을 생성.
 * 웹 프론트엔드의 buildHandoffMarkdown과 유사하나 제한 없이 전체 이벤트를 포함.
 */

import type { TimelineEvent } from "@monitor/core";

import {
  buildLaneSections,
  buildModifiedFilesSection,
  buildOpenTodoSection,
  buildOriginalRequestSection,
  buildPlanSection,
  buildVerificationSummarySection
} from "./workflow-context-builder.helpers.js";

export function buildWorkflowContext(events: readonly TimelineEvent[], taskTitle: string): string {
  const parts: string[] = [`# Workflow: ${taskTitle}`];

  const originalRequestSection = buildOriginalRequestSection(events);
  if (originalRequestSection) {
    parts.push(originalRequestSection);
  }

  const planSection = buildPlanSection(events);
  if (planSection) {
    parts.push(planSection);
  }

  parts.push(...buildLaneSections(events));

  const modifiedFilesSection = buildModifiedFilesSection(events);
  if (modifiedFilesSection) {
    parts.push(modifiedFilesSection);
  }

  const openTodoSection = buildOpenTodoSection(events);
  if (openTodoSection) {
    parts.push(openTodoSection);
  }

  const verificationSummarySection = buildVerificationSummarySection(events);
  if (verificationSummarySection) {
    parts.push(verificationSummarySection);
  }

  return parts.join("");
}
