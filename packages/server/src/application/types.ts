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

/**
 * 캐노니컬 user.message 이벤트 입력 (contractVersion "1").
 *
 * 자동 이미터(source=opencode-plugin | claude-hook)는 반드시 sessionId를 제공해야 한다.
 * derived 레코드는 반드시 sourceEventId로 raw 소스 이벤트를 참조해야 한다.
 */
export interface TaskUserMessageInput {
  readonly taskId: string;
  /** 자동 이미터(opencode-plugin, claude-hook)는 필수. */
  readonly sessionId?: string;
  /** 클라이언트 할당 메시지 ID (중복 방지용). */
  readonly messageId: string;
  /** raw = 실제 사용자 입력 텍스트; derived = raw 소스에 연결된 보강 레코드. */
  readonly captureMode: "raw" | "derived";
  /** 이미터 식별자: opencode-plugin | claude-hook | manual-mcp | <custom>. */
  readonly source: string;
  /** initial = 작업 항목의 첫 메시지; follow_up = 후속 메시지. */
  readonly phase?: "initial" | "follow_up";
  readonly title: string;
  readonly body?: string;
  /** captureMode=derived 시 필수. raw 소스 이벤트 ID. */
  readonly sourceEventId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly contractVersion?: string;
}

/**
 * 세션-종료 입력.
 * 현재 런타임 세션만 종료하며 태스크는 running 상태를 유지한다.
 * 작업 항목 종료는 task-complete 를 명시적으로 호출해야 한다.
 */
export interface TaskSessionEndInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly summary?: string;
  readonly metadata?: Record<string, unknown>;
}

/** question.logged 이벤트 입력. questionPhase=concluded는 planning 레인으로 라우팅됨. */
export interface TaskQuestionInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly questionId: string;
  readonly questionPhase: "asked" | "answered" | "concluded";
  readonly sequence?: number;
  readonly title: string;
  readonly body?: string;
  readonly modelName?: string;
  readonly modelProvider?: string;
  readonly metadata?: Record<string, unknown>;
}

/** todo.logged 이벤트 입력. planning 레인으로 라우팅됨. */
export interface TaskTodoInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly todoId: string;
  readonly todoState: "added" | "in_progress" | "completed" | "cancelled";
  readonly sequence?: number;
  readonly title: string;
  readonly body?: string;
  readonly metadata?: Record<string, unknown>;
}

/** thought.logged 이벤트 입력. 요약된 추론만 허용 (raw chain-of-thought 금지). planning 레인. */
export interface TaskThoughtInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly title: string;
  readonly body?: string;
  readonly modelName?: string;
  readonly modelProvider?: string;
  readonly metadata?: Record<string, unknown>;
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
