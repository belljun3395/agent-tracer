import type { MonitoringEventKind } from "~domain/monitoring/event.kind.js";
import type { BaseIngestEventInput } from "./log.event.usecase.dto.js";

export type ToolUsedInput           = BaseIngestEventInput & { readonly kind: "tool.used" }
export type TerminalCommandInput    = BaseIngestEventInput & { readonly kind: "terminal.command" }
export type PlanLoggedInput         = BaseIngestEventInput & { readonly kind: "plan.logged" }
export type ActionLoggedInput       = BaseIngestEventInput & { readonly kind: "action.logged" }
export type VerificationLoggedInput = BaseIngestEventInput & { readonly kind: "verification.logged" }
export type RuleLoggedInput         = BaseIngestEventInput & { readonly kind: "rule.logged" }
export type ContextSavedInput       = BaseIngestEventInput & { readonly kind: "context.saved" }
export type InstructionsLoadedInput = BaseIngestEventInput & { readonly kind: "instructions.loaded" }
export type SessionEndedInput       = BaseIngestEventInput & { readonly kind: "session.ended" }
export type AgentActivityLoggedInput = BaseIngestEventInput & { readonly kind: "agent.activity.logged" }
export type UserMessageInput        = BaseIngestEventInput & { readonly kind: "user.message" }
export type AssistantResponseInput  = BaseIngestEventInput & { readonly kind: "assistant.response" }
export type QuestionLoggedInput     = BaseIngestEventInput & { readonly kind: "question.logged" }
export type TodoLoggedInput         = BaseIngestEventInput & { readonly kind: "todo.logged" }
export type ThoughtLoggedInput      = BaseIngestEventInput & { readonly kind: "thought.logged" }
export type TokenUsageInput         = BaseIngestEventInput & { readonly kind: "token.usage" }
export type ContextSnapshotInput    = BaseIngestEventInput & { readonly kind: "context.snapshot" }

export type IngestEventInput =
    | ToolUsedInput | TerminalCommandInput | PlanLoggedInput | ActionLoggedInput
    | VerificationLoggedInput | RuleLoggedInput | ContextSavedInput | InstructionsLoadedInput
    | SessionEndedInput | AgentActivityLoggedInput | UserMessageInput | AssistantResponseInput
    | QuestionLoggedInput | TodoLoggedInput | ThoughtLoggedInput | TokenUsageInput
    | ContextSnapshotInput

export interface IngestAccepted {
    readonly eventId: string
    readonly kind: MonitoringEventKind
    readonly taskId: string
}

export interface IngestRejected {
    readonly index: number
    readonly code: string
    readonly message: string
}

export interface IngestResult {
    readonly accepted: readonly IngestAccepted[]
    readonly rejected: readonly IngestRejected[]
}
