/**
 * @module application/services/task-display-title-resolver
 *
 * 태스크 표시 제목 추론 로직.
 * DB 레이어에서 분리하여 이미 로드된 task + events 배열로 동작한다.
 */

import type { MonitoringTask, TimelineEvent } from "@monitor/core";

const GENERIC_TASK_TITLE_PREFIXES = new Set([
  "agent",
  "ai cli",
  "aider",
  "claude",
  "claude code",
  "codex",
  "cursor",
  "gemini",
  "gemini cli",
  "open code",
  "opencode"
]);

export class TaskDisplayTitleResolver {
  resolve(task: MonitoringTask, events: readonly TimelineEvent[]): string | undefined {
    return deriveTaskDisplayTitle(task, events);
  }
}

function deriveTaskDisplayTitle(
  task: MonitoringTask | null | undefined,
  timeline: readonly TimelineEvent[]
): string | undefined {
  return resolvePreferredTaskTitle(task, timeline) ?? undefined;
}

function resolvePreferredTaskTitle(
  task: MonitoringTask | null | undefined,
  timeline: readonly TimelineEvent[]
): string | null {
  return meaningfulTaskTitle(task) ?? inferTaskTitleSignal(timeline) ?? normalizeFallbackTaskTitle(task?.title);
}

function meaningfulTaskTitle(task: MonitoringTask | null | undefined): string | null {
  const title = normalizeSentence(task?.title);

  if (!title) {
    return null;
  }

  return isGenericWorkspaceTaskTitle(task, title) ? null : title;
}

function inferTaskTitleSignal(timeline: readonly TimelineEvent[]): string | null {
  const userGoal = timeline.find((event) =>
    event.lane === "user"
    && event.kind !== "task.start"
    && event.kind !== "task.complete"
    && event.kind !== "task.error"
    && event.body
  )?.body;
  const startSummary = timeline.find((event) => event.kind === "task.start" && event.body)?.body;
  const firstMeaningfulEvent = timeline.find((event) =>
    event.kind !== "task.start"
    && event.kind !== "task.complete"
    && event.kind !== "task.error"
    && event.kind !== "file.changed"
  );

  return (
    meaningfulInferredTaskTitle(userGoal)
    ?? meaningfulInferredTaskTitle(startSummary)
    ?? meaningfulInferredTaskTitle(firstMeaningfulEvent?.body)
    ?? meaningfulInferredTaskTitle(firstMeaningfulEvent?.title)
  );
}

function meaningfulInferredTaskTitle(value?: string): string | null {
  const normalized = normalizeSentence(value);

  if (!normalized || isAgentSessionBoilerplate(normalized)) {
    return null;
  }

  return normalized;
}

function isGenericWorkspaceTaskTitle(
  task: MonitoringTask | null | undefined,
  normalizedTitle: string
): boolean {
  if (!task) {
    return false;
  }

  const segments = normalizedTitle.split(/\s+[—–-]\s+/);
  if (segments.length !== 2) {
    return false;
  }

  const [prefix, suffix] = segments;
  const normalizedPrefix = normalizeTitleToken(prefix);
  if (!GENERIC_TASK_TITLE_PREFIXES.has(normalizedPrefix)) {
    return false;
  }

  const workspaceName = task.workspacePath
    ?.split("/")
    .filter(Boolean)
    .pop();
  const normalizedSuffix = normalizeTitleToken(stripTrailingSessionSuffix(suffix));

  return normalizedSuffix === normalizeTitleToken(task.slug)
    || (workspaceName ? normalizedSuffix === normalizeTitleToken(workspaceName) : false);
}

function normalizeFallbackTaskTitle(value?: string): string | null {
  const normalized = normalizeSentence(value);
  if (!normalized) return null;
  return stripTrailingSessionSuffix(normalized);
}

function stripTrailingSessionSuffix(value: string): string {
  return value.replace(/\s+\((?:ses_[^)]+|session[^)]*|sess[^)]*)\)\s*$/i, "").trim();
}

function normalizeTitleToken(value?: string): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function isAgentSessionBoilerplate(value: string): boolean {
  const normalized = normalizeTitleToken(value);

  return /^(claude code|claude|opencode|open code|codex|cursor|gemini(?: cli)?|agent|ai cli) session started\b/.test(normalized)
    || /^(claude code|claude|opencode|open code|codex|cursor|gemini(?: cli)?|agent|ai cli) - /.test(normalized);
}

function normalizeSentence(value?: string): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > 120
    ? `${normalized.slice(0, 117)}...`
    : normalized;
}
