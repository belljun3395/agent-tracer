/**
 * @module application/types
 *
 * 서비스 레이어 입력 DTO.
 * HTTP 요청 본문이 검증된 후 MonitorService 메서드에 전달되는 타입.
 */

import type {
  AgentActivityType,
  EventRelationType,
  MonitoringEventKind
} from "@monitor/core";

export interface TaskStartInput {
  readonly taskId?: string;
  readonly title: string;
  readonly workspacePath?: string;
  readonly summary?: string;
  readonly taskKind?: "primary" | "background";
  readonly parentTaskId?: string;
  readonly parentSessionId?: string;
  readonly backgroundTaskId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface TaskLinkInput {
  readonly taskId: string;
  readonly title?: string;
  readonly taskKind?: "primary" | "background";
  readonly parentTaskId?: string;
  readonly parentSessionId?: string;
  readonly backgroundTaskId?: string;
}

export interface TaskRenameInput {
  readonly taskId: string;
  readonly title: string;
}

export interface TaskPatchInput {
  readonly taskId: string;
  readonly title?: string;
  readonly status?: "running" | "waiting" | "completed" | "errored";
}

export type TaskCompletionReason =
  | "idle"
  | "assistant_turn_complete"
  | "explicit_exit"
  | "runtime_terminated";

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
  readonly lane?: string;
  readonly filePaths?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * 카드 간 인과 관계와 워크아이템 식별자를 전달하는 공통 trace 필드.
 * UI는 이 값을 사용해 "무엇 다음에 무엇이 왔는가"가 아니라
 * "왜 이어졌는가"를 재구성한다.
 */
export interface TraceRelationInput {
  readonly parentEventId?: string;
  readonly relatedEventIds?: readonly string[];
  readonly workItemId?: string;
  readonly goalId?: string;
  readonly planId?: string;
  readonly handoffId?: string;
  readonly relationType?: EventRelationType;
  readonly relationLabel?: string;
  readonly relationExplanation?: string;
}

/** MCP/skill/delegation 같은 coordination 레인 활동을 표현하는 공통 필드. */
export interface TraceActivityInput extends TraceRelationInput {
  readonly activityType?: AgentActivityType;
  readonly agentName?: string;
  readonly skillName?: string;
  readonly skillPath?: string;
  readonly mcpServer?: string;
  readonly mcpTool?: string;
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

export type TaskPlanInput = TaskActionBaseInput & TraceRelationInput;

export type TaskActionInput = TaskActionBaseInput & TraceRelationInput;

export interface TaskVerifyInput extends TaskActionBaseInput, TraceRelationInput {
  readonly result: string;
  readonly status?: string;
}

export interface TaskRuleInput extends TaskActionBaseInput, TraceRelationInput {
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

export interface TaskAgentActivityInput extends TraceActivityInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly activityType: AgentActivityType;
  readonly title?: string;
  readonly body?: string;
  readonly lane?: string;
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
 * sessionId는 모든 호출자에게 필수다 (서버가 자동으로 세션을 유추하지 않는다).
 * derived 레코드는 반드시 sourceEventId로 raw 소스 이벤트를 참조해야 한다.
 */
export interface TaskUserMessageInput {
  readonly taskId: string;
  /** 모든 호출자에게 필수. source는 이미터를 식별하는 불투명 메타데이터. */
  readonly sessionId: string;
  /** 클라이언트 할당 메시지 ID (중복 방지용). */
  readonly messageId: string;
  /** raw = 실제 사용자 입력 텍스트; derived = raw 소스에 연결된 보강 레코드. */
  readonly captureMode: "raw" | "derived";
  /** 이미터 식별자 (불투명 메타데이터): manual-mcp | <runtime-adapter> | <custom>. */
  readonly source: string;
  /** initial = 작업 항목의 첫 메시지; follow_up = 후속 메시지. 생략 시 서버가 기존 raw user.message 이벤트 수로 자동 도출. */
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
 * 기본적으로 세션만 종료하고 태스크 상태는 유지한다.
 * completeTask=true 이면 primary 태스크를 completed로 전이한다.
 */
export interface TaskSessionEndInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly completeTask?: boolean;
  readonly completionReason?: TaskCompletionReason;
  readonly summary?: string;
  readonly backgroundCompletions?: string[];
  readonly metadata?: Record<string, unknown>;
}

/** question.logged 이벤트 입력. questionPhase=concluded는 planning 레인으로 라우팅됨. */
export interface TaskQuestionInput extends TraceRelationInput {
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
export interface TaskTodoInput extends TraceRelationInput {
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
export interface TaskThoughtInput extends TraceRelationInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly title: string;
  readonly body?: string;
  readonly modelName?: string;
  readonly modelProvider?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface GenericEventInput extends TraceActivityInput {
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

export interface TaskBookmarkInput {
  readonly taskId: string;
  readonly eventId?: string;
  readonly title?: string;
  readonly note?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface TaskBookmarkDeleteInput {
  readonly bookmarkId: string;
}

export interface TaskSearchInput {
  readonly query: string;
  readonly taskId?: string;
  readonly limit?: number;
}

export interface TaskAssistantResponseInput {
  readonly taskId: string;
  readonly sessionId?: string;
  readonly messageId: string;
  readonly source: string;
  readonly title: string;
  readonly body?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * 제너릭 런타임-세션 보장 입력.
 * 어떤 런타임 어댑터라도 runtimeSource + runtimeSessionId 쌍으로 task/session을 자동 생성·재개한다.
 */
export interface RuntimeSessionEnsureInput {
  readonly runtimeSource: string;
  readonly runtimeSessionId: string;
  readonly title: string;
  readonly workspacePath?: string;
  readonly parentTaskId?: string;
  readonly parentSessionId?: string;
}

export interface RuntimeSessionEnsureResult {
  readonly taskId: string;
  readonly sessionId: string;
  readonly taskCreated: boolean;
  readonly sessionCreated: boolean;
}

export interface RuntimeSessionEndInput {
  readonly runtimeSource: string;
  readonly runtimeSessionId: string;
  readonly summary?: string;
  /** Claude hook path keeps this unset; OpenCode primary shutdown may set true explicitly. */
  readonly completeTask?: boolean;
  readonly completionReason?: TaskCompletionReason;
  readonly backgroundCompletions?: string[];
}
