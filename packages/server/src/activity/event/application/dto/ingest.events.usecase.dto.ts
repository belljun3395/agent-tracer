export type IngestEventsTimelineLane =
    | "user"
    | "exploration"
    | "planning"
    | "implementation"
    | "questions"
    | "todos"
    | "background"
    | "coordination"
    | "telemetry"
    | "rule";

export type IngestEventsEventRelationType =
    | "implements"
    | "revises"
    | "verifies"
    | "answers"
    | "delegates"
    | "returns"
    | "completes"
    | "blocks"
    | "caused_by"
    | "relates_to";

export type LoggedEventKind =
    | "tool.used"
    | "terminal.command"
    | "monitor.observed"
    | "plan.logged"
    | "action.logged"
    | "verification.logged"
    | "rule.logged"
    | "thought.logged"
    | "context.saved"
    | "context.snapshot"
    | "user.message"
    | "assistant.response"
    | "question.logged"
    | "todo.logged"
    | "agent.activity.logged"
    | "session.ended"
    | "instructions.loaded"
    | "token.usage"
    | "user.prompt.expansion"
    | "permission.request"
    | "worktree.create"
    | "worktree.remove"
    | "setup.triggered"
    | "task.start"
    | "task.complete"
    | "task.error"
    | "file.changed";

export interface IngestEventsBaseEventUseCaseIn {
    readonly kind: Exclude<LoggedEventKind, "task.start" | "task.complete" | "task.error">;
    readonly taskId: string;
    readonly sessionId?: string | undefined;
    readonly title?: string | undefined;
    readonly body?: string | undefined;
    readonly lane: IngestEventsTimelineLane;
    readonly filePaths?: readonly string[] | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
    readonly parentEventId?: string | undefined;
    readonly relatedEventIds?: readonly string[] | undefined;
    readonly relationType?: IngestEventsEventRelationType | undefined;
    readonly relationLabel?: string | undefined;
    readonly relationExplanation?: string | undefined;
    readonly createdAt?: string | undefined;
    readonly taskEffects?: { readonly taskStatus?: string | undefined } | undefined;
}

export type ToolUsedUseCaseIn           = IngestEventsBaseEventUseCaseIn & { readonly kind: "tool.used" }
export type TerminalCommandUseCaseIn    = IngestEventsBaseEventUseCaseIn & { readonly kind: "terminal.command" }
export type PlanLoggedUseCaseIn         = IngestEventsBaseEventUseCaseIn & { readonly kind: "plan.logged" }
export type ActionLoggedUseCaseIn       = IngestEventsBaseEventUseCaseIn & { readonly kind: "action.logged" }
export type VerificationLoggedUseCaseIn = IngestEventsBaseEventUseCaseIn & { readonly kind: "verification.logged" }
export type RuleLoggedUseCaseIn         = IngestEventsBaseEventUseCaseIn & { readonly kind: "rule.logged" }
export type ContextSavedUseCaseIn       = IngestEventsBaseEventUseCaseIn & { readonly kind: "context.saved" }
export type InstructionsLoadedUseCaseIn = IngestEventsBaseEventUseCaseIn & { readonly kind: "instructions.loaded" }
export type SessionEndedUseCaseIn       = IngestEventsBaseEventUseCaseIn & { readonly kind: "session.ended" }
export type AgentActivityLoggedUseCaseIn = IngestEventsBaseEventUseCaseIn & { readonly kind: "agent.activity.logged" }
export type UserMessageUseCaseIn        = IngestEventsBaseEventUseCaseIn & { readonly kind: "user.message" }
export type AssistantResponseUseCaseIn  = IngestEventsBaseEventUseCaseIn & { readonly kind: "assistant.response" }
export type QuestionLoggedUseCaseIn     = IngestEventsBaseEventUseCaseIn & { readonly kind: "question.logged" }
export type TodoLoggedUseCaseIn         = IngestEventsBaseEventUseCaseIn & { readonly kind: "todo.logged" }
export type ThoughtLoggedUseCaseIn      = IngestEventsBaseEventUseCaseIn & { readonly kind: "thought.logged" }
export type TokenUsageUseCaseIn         = IngestEventsBaseEventUseCaseIn & { readonly kind: "token.usage" }
export type ContextSnapshotUseCaseIn    = IngestEventsBaseEventUseCaseIn & { readonly kind: "context.snapshot" }
export type MonitorObservedUseCaseIn    = IngestEventsBaseEventUseCaseIn & { readonly kind: "monitor.observed" }
export type UserPromptExpansionUseCaseIn = IngestEventsBaseEventUseCaseIn & { readonly kind: "user.prompt.expansion" }
export type PermissionRequestUseCaseIn  = IngestEventsBaseEventUseCaseIn & { readonly kind: "permission.request" }
export type WorktreeCreateUseCaseIn     = IngestEventsBaseEventUseCaseIn & { readonly kind: "worktree.create" }
export type WorktreeRemoveUseCaseIn     = IngestEventsBaseEventUseCaseIn & { readonly kind: "worktree.remove" }
export type SetupTriggeredUseCaseIn     = IngestEventsBaseEventUseCaseIn & { readonly kind: "setup.triggered" }
export type FileChangedUseCaseIn        = IngestEventsBaseEventUseCaseIn & { readonly kind: "file.changed" }

export type IngestEventsUseCaseEventDto =
    | ToolUsedUseCaseIn | TerminalCommandUseCaseIn | PlanLoggedUseCaseIn | ActionLoggedUseCaseIn
    | VerificationLoggedUseCaseIn | RuleLoggedUseCaseIn | ContextSavedUseCaseIn | InstructionsLoadedUseCaseIn
    | SessionEndedUseCaseIn | AgentActivityLoggedUseCaseIn | UserMessageUseCaseIn | AssistantResponseUseCaseIn
    | QuestionLoggedUseCaseIn | TodoLoggedUseCaseIn | ThoughtLoggedUseCaseIn | TokenUsageUseCaseIn
    | ContextSnapshotUseCaseIn | MonitorObservedUseCaseIn | UserPromptExpansionUseCaseIn
    | PermissionRequestUseCaseIn | WorktreeCreateUseCaseIn | WorktreeRemoveUseCaseIn
    | SetupTriggeredUseCaseIn | FileChangedUseCaseIn

export interface IngestEventsUseCaseIn {
    readonly events: readonly IngestEventsUseCaseEventDto[]
}

export interface IngestEventsUseCaseAcceptedDto {
    readonly eventId: string
    readonly kind: LoggedEventKind
    readonly taskId: string
}

export interface IngestEventsUseCaseRejectedDto {
    readonly index: number
    readonly code: string
    readonly message: string
}

export interface IngestEventsUseCaseOut {
    readonly accepted: readonly IngestEventsUseCaseAcceptedDto[]
    readonly rejected: readonly IngestEventsUseCaseRejectedDto[]
}
