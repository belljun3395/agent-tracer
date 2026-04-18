import type { ActionName, AgentActivityType, AsyncTaskId, BookmarkId, EventId, EventRelationType, MessageId, ModelName, ModelProvider, MonitoringEventKind, QuestionId, QuestionPhase, RuleId, RuntimeSessionId, RuntimeSource, SessionId, TaskId, TimelineLane, TodoId, TodoState, ToolName, WorkspacePath } from "@monitor/domain";
export interface TaskStartInput {
    readonly taskId?: TaskId;
    readonly title: string;
    readonly workspacePath?: WorkspacePath;
    readonly runtimeSource?: RuntimeSource;
    readonly summary?: string;
    readonly taskKind?: "primary" | "background";
    readonly parentTaskId?: TaskId;
    readonly parentSessionId?: SessionId;
    readonly backgroundTaskId?: TaskId;
    readonly metadata?: Record<string, unknown>;
}
export interface TaskLinkInput {
    readonly taskId: TaskId;
    readonly title?: string;
    readonly taskKind?: "primary" | "background";
    readonly parentTaskId?: TaskId;
    readonly parentSessionId?: SessionId;
    readonly backgroundTaskId?: TaskId;
}
export interface TaskRenameInput {
    readonly taskId: TaskId;
    readonly title: string;
}
export interface TaskPatchInput {
    readonly taskId: TaskId;
    readonly title?: string;
    readonly status?: "running" | "waiting" | "completed" | "errored";
}
export interface EventPatchInput {
    readonly eventId: EventId;
    readonly displayTitle?: string | null;
}
export type TaskCompletionReason = "idle" | "assistant_turn_complete" | "explicit_exit" | "runtime_terminated";
export interface TaskTerminalCommandInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly command: string;
    readonly title?: string;
    readonly body?: string;
    readonly lane?: TimelineLane;
    readonly filePaths?: readonly string[];
    readonly metadata?: Record<string, unknown>;
}
export interface TaskToolUsedInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly toolName: ToolName;
    readonly title?: string;
    readonly body?: string;
    readonly lane?: TimelineLane;
    readonly filePaths?: readonly string[];
    readonly metadata?: Record<string, unknown>;
}
export interface TaskContextSavedInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly title: string;
    readonly body?: string;
    readonly lane?: TimelineLane;
    readonly filePaths?: readonly string[];
    readonly metadata?: Record<string, unknown>;
}
export interface TaskExploreInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly toolName: ToolName;
    readonly title: string;
    readonly body?: string;
    readonly lane?: TimelineLane;
    readonly filePaths?: readonly string[];
    readonly metadata?: Record<string, unknown>;
}
export interface TraceRelationInput {
    readonly parentEventId?: EventId;
    readonly relatedEventIds?: readonly EventId[];
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
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly action: ActionName;
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
    readonly ruleId: RuleId;
    readonly severity: string;
    readonly status: string;
    readonly source?: string;
    readonly policy?: "audit" | "warn" | "block" | "approval_required";
    readonly outcome?: "observed" | "warned" | "blocked" | "approval_requested" | "approved" | "rejected" | "bypassed";
}
export interface TaskAsyncLifecycleInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly asyncTaskId: AsyncTaskId;
    readonly asyncStatus: "pending" | "running" | "completed" | "error" | "cancelled" | "interrupt";
    readonly title?: string;
    readonly body?: string;
    readonly description?: string;
    readonly agent?: string;
    readonly category?: string;
    readonly parentSessionId?: SessionId;
    readonly durationMs?: number;
    readonly filePaths?: readonly string[];
    readonly metadata?: Record<string, unknown>;
}
export interface TaskAgentActivityInput extends TraceActivityInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly activityType: AgentActivityType;
    readonly title?: string;
    readonly body?: string;
    readonly lane?: TimelineLane;
    readonly filePaths?: readonly string[];
    readonly metadata?: Record<string, unknown>;
}
export interface TaskCompletionInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
}
export interface TaskErrorInput extends TaskCompletionInput {
    readonly errorMessage: string;
}
export interface TaskUserMessageInput {
    readonly taskId: TaskId;
    readonly sessionId: SessionId;
    readonly messageId: MessageId;
    readonly captureMode: "raw" | "derived";
    readonly source: string;
    readonly phase: "initial" | "follow_up";
    readonly title: string;
    readonly body?: string;
    readonly sourceEventId?: EventId;
    readonly metadata?: Record<string, unknown>;
    readonly contractVersion?: string;
}
export interface TaskSessionEndInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly completeTask?: boolean;
    readonly completionReason?: TaskCompletionReason;
    readonly summary?: string;
    readonly backgroundCompletions?: TaskId[];
    readonly metadata?: Record<string, unknown>;
}
export interface TaskQuestionInput extends TraceRelationInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly questionId: QuestionId;
    readonly questionPhase: QuestionPhase;
    readonly sequence?: number;
    readonly title: string;
    readonly body?: string;
    readonly modelName?: ModelName;
    readonly modelProvider?: ModelProvider;
    readonly metadata?: Record<string, unknown>;
}
export interface TaskTodoInput extends TraceRelationInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly todoId: TodoId;
    readonly todoState: TodoState;
    readonly sequence?: number;
    readonly title: string;
    readonly body?: string;
    readonly metadata?: Record<string, unknown>;
}
export interface TaskThoughtInput extends TraceRelationInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly title: string;
    readonly body?: string;
    readonly modelName?: ModelName;
    readonly modelProvider?: ModelProvider;
    readonly metadata?: Record<string, unknown>;
}
export interface GenericEventInput extends TraceActivityInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly kind: MonitoringEventKind;
    readonly lane?: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly command?: string;
    readonly toolName?: ToolName;
    readonly actionName?: ActionName;
    readonly filePaths?: readonly string[];
    readonly metadata?: Record<string, unknown>;
}
export interface TaskBookmarkInput {
    readonly taskId: TaskId;
    readonly eventId?: EventId;
    readonly title?: string;
    readonly note?: string;
    readonly metadata?: Record<string, unknown>;
}
export interface TaskBookmarkDeleteInput {
    readonly bookmarkId: BookmarkId;
}
export interface TaskSearchInput {
    readonly query: string;
    readonly taskId?: TaskId;
    readonly limit?: number;
}
export interface TaskAssistantResponseInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly messageId: MessageId;
    readonly source: string;
    readonly title: string;
    readonly body?: string;
    readonly metadata?: Record<string, unknown>;
}
export interface TaskTokenUsageInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreateTokens: number;
    readonly costUsd?: number;
    readonly durationMs?: number;
    readonly model?: string;
    readonly promptId?: string;
}
export interface RuntimeSessionEnsureInput {
    readonly taskId?: TaskId;
    readonly runtimeSource: RuntimeSource;
    readonly runtimeSessionId: RuntimeSessionId;
    readonly title: string;
    readonly workspacePath?: WorkspacePath;
    readonly parentTaskId?: TaskId;
    readonly parentSessionId?: SessionId;
}
export interface RuntimeSessionEnsureResult {
    readonly taskId: TaskId;
    readonly sessionId: SessionId;
    readonly taskCreated: boolean;
    readonly sessionCreated: boolean;
}
export interface RuntimeSessionEndInput {
    readonly runtimeSource: RuntimeSource;
    readonly runtimeSessionId: RuntimeSessionId;
    readonly summary?: string;
    readonly completeTask?: boolean;
    readonly completionReason?: TaskCompletionReason;
    readonly backgroundCompletions?: readonly TaskId[];
}
