import type { AgentActivityType, EventRelationType, MonitoringEventKind } from "@monitor/core";
export interface TaskStartInput {
    readonly taskId?: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
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
export interface EventPatchInput {
    readonly eventId: string;
    readonly displayTitle?: string | null;
}
export type TaskCompletionReason = "idle" | "assistant_turn_complete" | "explicit_exit" | "runtime_terminated";
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
export interface TraceRelationInput {
    readonly parentEventId?: string;
    readonly relatedEventIds?: readonly string[];
    readonly relationType?: EventRelationType;
    readonly relationLabel?: string;
    readonly relationExplanation?: string;
}
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
    readonly policy?: "audit" | "warn" | "block" | "approval_required";
    readonly outcome?: "observed" | "warned" | "blocked" | "approval_requested" | "approved" | "rejected" | "bypassed";
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
export interface TaskUserMessageInput {
    readonly taskId: string;
    readonly sessionId: string;
    readonly messageId: string;
    readonly captureMode: "raw" | "derived";
    readonly source: string;
    readonly phase?: "initial" | "follow_up";
    readonly title: string;
    readonly body?: string;
    readonly sourceEventId?: string;
    readonly metadata?: Record<string, unknown>;
    readonly contractVersion?: string;
}
export interface TaskSessionEndInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly completeTask?: boolean;
    readonly completionReason?: TaskCompletionReason;
    readonly summary?: string;
    readonly backgroundCompletions?: string[];
    readonly metadata?: Record<string, unknown>;
}
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
export interface RuntimeSessionEnsureInput {
    readonly taskId?: string;
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
    readonly completeTask?: boolean;
    readonly completionReason?: TaskCompletionReason;
    readonly backgroundCompletions?: string[];
}
