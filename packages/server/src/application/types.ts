/**
 * @module application/types
 *
 * 서비스 레이어 입력 DTO.
 * HTTP 요청 본문이 검증된 후 MonitorService 메서드에 전달되는 타입.
 */

import type { MonitoringEventKind } from "@monitor/core";

export interface TaskStartInput {
  readonly taskId?: string;
  readonly title: string;
  readonly workspacePath?: string;
  readonly summary?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface TaskRenameInput {
  readonly taskId: string;
  readonly title: string;
}

export interface TaskTerminalCommandInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly command: string;
  readonly title?: string;
  readonly body?: string;
  readonly lane?: string;
  readonly filePaths?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface TaskToolUsedInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly toolName: string;
  readonly title?: string;
  readonly body?: string;
  readonly lane?: string;
  readonly filePaths?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface TaskContextSavedInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly title: string;
  readonly body?: string;
  readonly lane?: string;
  readonly filePaths?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface TaskExploreInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly toolName: string;
  readonly title: string;
  readonly body?: string;
  readonly filePaths?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

interface TaskActionBaseInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly action: string;
  readonly title?: string;
  readonly body?: string;
  readonly filePaths?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export type TaskPlanInput = TaskActionBaseInput;

export type TaskActionInput = TaskActionBaseInput;

export interface TaskVerifyInput extends TaskActionBaseInput {
  readonly result: string;
  readonly status?: string;
}

export interface TaskRuleInput extends TaskActionBaseInput {
  readonly ruleId: string;
  readonly severity: string;
  readonly status: string;
  readonly source?: string;
}

export interface TaskAsyncLifecycleInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly asyncTaskId: string;
  readonly asyncStatus: "pending" | "running" | "completed" | "error" | "cancelled" | "interrupt";
  readonly title?: string;
  readonly body?: string;
  readonly description?: string;
  readonly agent?: string;
  readonly category?: string;
  readonly parentSessionId?: string;
  readonly durationMs?: number;
  readonly filePaths?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface TaskCompletionInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly summary?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface TaskErrorInput extends TaskCompletionInput {
  readonly errorMessage: string;
}

export interface GenericEventInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly kind: MonitoringEventKind;
  readonly lane?: string;
  readonly title: string;
  readonly body?: string;
  readonly command?: string;
  readonly toolName?: string;
  readonly actionName?: string;
  readonly filePaths?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}
