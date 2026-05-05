export const EVENT_LANES = [
    "user",
    "exploration",
    "planning",
    "implementation",
    "questions",
    "todos",
    "background",
    "coordination",
    "telemetry",
    "rule",
] as const;

export const TOOL_ACTIVITY_EVENT_KINDS = ["tool.used", "terminal.command", "monitor.observed"] as const;
export const WORKFLOW_EVENT_KINDS = [
    "plan.logged",
    "action.logged",
    "verification.logged",
    "rule.logged",
    "thought.logged",
    "context.saved",
    "context.snapshot",
    "user.prompt.expansion",
    "permission.request",
    "worktree.create",
    "worktree.remove",
    "setup.triggered",
    "file.changed",
] as const;
export const CONVERSATION_EVENT_KINDS = ["user.message", "assistant.response", "question.logged", "todo.logged"] as const;
export const COORDINATION_EVENT_KINDS = ["agent.activity.logged"] as const;
export const LIFECYCLE_EVENT_KINDS = ["session.ended", "instructions.loaded"] as const;
export const TELEMETRY_EVENT_KINDS = ["token.usage"] as const;
export const INGEST_EVENT_KINDS = [
    ...TOOL_ACTIVITY_EVENT_KINDS,
    ...WORKFLOW_EVENT_KINDS,
    ...CONVERSATION_EVENT_KINDS,
    ...COORDINATION_EVENT_KINDS,
    ...LIFECYCLE_EVENT_KINDS,
    ...TELEMETRY_EVENT_KINDS,
] as const;
const _INTERNAL_EVENT_KINDS = ["task.start", "task.complete", "task.error"] as const;

export const EVENT_RELATION_TYPES = [
    "implements",
    "revises",
    "verifies",
    "answers",
    "delegates",
    "returns",
    "completes",
    "blocks",
    "caused_by",
    "relates_to",
] as const;

export type TimelineLane = (typeof EVENT_LANES)[number];
export type IngestEventKind = (typeof INGEST_EVENT_KINDS)[number];
export type LoggedEventKind = IngestEventKind | (typeof _INTERNAL_EVENT_KINDS)[number];
export type EventRelationType = (typeof EVENT_RELATION_TYPES)[number];

export type LogEventTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";
export type LogEventTaskKindUseCaseDto = "primary" | "background";

export interface LogEventTaskUseCaseDto {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workspacePath?: string;
    readonly status: LogEventTaskStatusUseCaseDto;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: LogEventTaskKindUseCaseDto;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface LogEventUseCaseIn {
    readonly kind: IngestEventKind;
    readonly taskId: string;
    readonly sessionId?: string | undefined;
    readonly title?: string | undefined;
    readonly body?: string | undefined;
    readonly lane: TimelineLane;
    readonly filePaths?: readonly string[] | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
    readonly parentEventId?: string | undefined;
    readonly relatedEventIds?: readonly string[] | undefined;
    readonly relationType?: EventRelationType | undefined;
    readonly relationLabel?: string | undefined;
    readonly relationExplanation?: string | undefined;
    readonly createdAt?: string | undefined;
    readonly taskEffects?: { readonly taskStatus?: string | undefined } | undefined;
}

export interface LogEventUseCaseOut {
    readonly task: LogEventTaskUseCaseDto;
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: LoggedEventKind }[];
}
