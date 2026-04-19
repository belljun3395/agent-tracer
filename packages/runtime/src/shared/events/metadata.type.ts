import type {
    AgentActivityType,
    EventSubtypeGroup,
    EventSubtypeKey,
    EventToolFamily,
    EvidenceLevel,
    QuestionPhase,
    TaskCompletionReason,
    TaskStatus,
    TodoState,
    UserMessageCaptureMode,
    UserMessagePhase,
} from "./kinds.type.js";

export interface EventSemanticMetadata {
    readonly subtypeKey: EventSubtypeKey
    readonly subtypeLabel?: string
    readonly subtypeGroup?: EventSubtypeGroup
    readonly toolFamily?: EventToolFamily
    readonly operation?: string
    readonly entityType?: string
    readonly entityName?: string
    readonly sourceTool?: string
    readonly importance?: number
}

export interface RequiredEventMetadata {
    readonly evidenceLevel: EvidenceLevel
    readonly evidenceReason: string
    readonly tags?: readonly string[]
    readonly observabilityPhase?: string
    readonly signalTypes?: readonly string[]
}

export interface TaskEffects {
    readonly taskStatus?: TaskStatus
}

export type TerminalCommandMetadata = RequiredEventMetadata & EventSemanticMetadata & {
    readonly command: string
    readonly description?: string
    readonly toolUseId?: string
}

export type ToolUsedMetadata = RequiredEventMetadata & EventSemanticMetadata & {
    readonly toolName: string
    readonly filePath?: string
    readonly relPath?: string
    readonly toolInput?: Record<string, unknown>
    readonly webUrls?: readonly string[]
    readonly toolUseId?: string
}

export type AgentActivityMetadata = RequiredEventMetadata & EventSemanticMetadata & {
    readonly activityType: AgentActivityType
    readonly mcpServer?: string
    readonly mcpTool?: string
    readonly agentName?: string
    readonly skillName?: string
    readonly skillPath?: string
    readonly toolInput?: Record<string, unknown>
    readonly toolUseId?: string
}

export type ActionLoggedMetadata = RequiredEventMetadata & {
    readonly asyncTaskId?: string
    readonly asyncStatus?: string
    readonly asyncDurationMs?: number
    readonly asyncAgent?: string
    readonly asyncCategory?: string
    readonly agentId?: string
    readonly agentType?: string
    readonly parentTaskId?: string
    readonly parentSessionId?: string
    readonly childTaskId?: string
}

export type TodoLoggedMetadata = RequiredEventMetadata & {
    readonly todoId: string
    readonly todoState: TodoState
    readonly toolName?: string
    readonly priority?: string
    readonly status?: string
    readonly autoReconciled?: boolean
    readonly toolUseId?: string
}

export type ContextSavedMetadata = RequiredEventMetadata & {
    readonly trigger?: string
    readonly compactPhase?: "before" | "after"
    readonly attachmentType?: string
    readonly isInitial?: boolean
    readonly skillCount?: number
    readonly addedNames?: readonly string[]
    readonly removedNames?: readonly string[]
    readonly content?: unknown
    readonly itemCount?: number
    readonly instructionsBurst?: boolean
    readonly files?: unknown
    readonly planExists?: boolean
    readonly planFilePath?: string
}

export type AssistantResponseMetadata = RequiredEventMetadata & {
    readonly messageId: string
    readonly source: string
    readonly stopReason: string
    readonly redacted?: boolean
    readonly signatureLength?: number
    readonly contentIndex?: number
    readonly assistantUuid?: string
    readonly parentUuid?: string
    readonly requestId?: string
    readonly phase?: string
}

export type UserMessageMetadata = RequiredEventMetadata & {
    readonly messageId: string
    readonly captureMode: UserMessageCaptureMode
    readonly source: string
    readonly phase: UserMessagePhase
    readonly redacted?: boolean
    readonly signatureLength?: number
    readonly contentIndex?: number
    readonly assistantUuid?: string
    readonly parentUuid?: string
    readonly requestId?: string
}

export type InstructionsLoadedMetadata = RequiredEventMetadata & {
    readonly filePath: string
    readonly relPath: string
    readonly loadReason: string
    readonly memoryType: string
}

export type TokenUsageMetadata = RequiredEventMetadata & {
    readonly inputTokens: number
    readonly outputTokens: number
    readonly cacheReadTokens?: number
    readonly cacheCreateTokens?: number
    readonly costUsd?: number
    readonly durationMs?: number
    readonly model?: string
    readonly promptId?: string
    readonly stopReason?: string
}

export type SessionEndedMetadata = RequiredEventMetadata & {
    readonly reason: string
    readonly completionReason: TaskCompletionReason
    readonly source: string
    readonly sessionEndedAt: string
    readonly transcriptPath?: string
    readonly permissionMode?: string
    readonly cwd?: string
}

export type VerificationLoggedMetadata = RequiredEventMetadata & {
    readonly verificationStatus?: string
    readonly ruleId?: string
}

export type RuleLoggedMetadata = RequiredEventMetadata & {
    readonly ruleStatus?: string
    readonly ruleId?: string
    readonly severity?: string
    readonly ruleSource?: string
    readonly rulePolicy?: string
    readonly ruleOutcome?: string
}

export type QuestionLoggedMetadata = RequiredEventMetadata & {
    readonly questionId?: string
    readonly questionPhase?: QuestionPhase
    readonly sequence?: number
    readonly modelName?: string
    readonly modelProvider?: string
}

export type PlanLoggedMetadata = RequiredEventMetadata
export type ThoughtLoggedMetadata = RequiredEventMetadata
