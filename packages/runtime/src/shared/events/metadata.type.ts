import type {
    AgentActivityType,
    EventSubtypeGroup,
    EventSubtypeKey,
    EventToolFamily,
    EvidenceLevel,
    QuestionPhase,
    TaskCompletionReason,
    TodoState,
    UserMessageCaptureMode,
    UserMessagePhase,
} from "./kinds.type.js";
import type { CommandAnalysis } from "../semantics/command-analysis.js";

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

export type TerminalCommandMetadata = RequiredEventMetadata & EventSemanticMetadata & {
    readonly command: string
    readonly description?: string
    readonly toolUseId?: string
    readonly commandAnalysis?: CommandAnalysis
    readonly timeoutMs?: number
    readonly runInBackground?: boolean
    readonly crossCheck?: CrossCheckMarker
}

export type ToolUsedMetadata = RequiredEventMetadata & EventSemanticMetadata & {
    readonly toolName: string
    readonly filePath?: string
    readonly relPath?: string
    readonly toolInput?: Record<string, unknown>
    readonly webUrls?: readonly string[]
    readonly toolUseId?: string
    // Read tool extras (offset/limit + totalLines from result)
    readonly readOffset?: number
    readonly readLimit?: number
    // Glob/Grep tool extras
    readonly searchPattern?: string
    readonly searchPath?: string
    readonly searchGlob?: string
    readonly grepOutputMode?: "content" | "files_with_matches" | "count"
    readonly grepCaseInsensitive?: boolean
    readonly grepMultiline?: boolean
    // WebSearch/WebFetch extras
    readonly webQuery?: string
    readonly webPrompt?: string
    readonly webAllowedDomains?: readonly string[]
    readonly webBlockedDomains?: readonly string[]
    // Edit/Write extras
    readonly editReplaceAll?: boolean
    readonly crossCheck?: CrossCheckMarker
}

export type AgentActivityMetadata = RequiredEventMetadata & EventSemanticMetadata & {
    readonly activityType: AgentActivityType
    readonly mcpServer?: string
    readonly mcpTool?: string
    readonly agentName?: string
    readonly agentModel?: string
    readonly agentRunInBackground?: boolean
    readonly skillName?: string
    readonly skillPath?: string
    readonly toolInput?: Record<string, unknown>
    readonly toolUseId?: string
    readonly crossCheck?: CrossCheckMarker
}

/**
 * Marker emitted when both a hook and the rollout observer surface the same
 * Codex event (apply_patch / MCP / web_search). The server merges the two
 * sources by `(kind, sessionId, dedupeKey)` instead of inserting duplicates.
 */
export interface CrossCheckMarker {
    readonly source: "hook" | "rollout";
    readonly dedupeKey: string;
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

export type UserPromptExpansionMetadata = RequiredEventMetadata & {
    readonly expansionType: string
    readonly commandName: string
    readonly commandArgs?: string
    readonly commandSource?: string
    readonly expandedPromptSnippet?: string
    readonly expandedPromptBytes?: number
}

export type FileChangedMetadata = RequiredEventMetadata & {
    readonly filePath: string
    readonly relPath?: string
}

export type WorktreeMetadata = RequiredEventMetadata & {
    readonly worktreePath: string
    readonly relPath?: string
    readonly worktreeAction: "create" | "remove"
}

export type PermissionRequestMetadata = RequiredEventMetadata & {
    readonly toolName: string
    readonly toolUseId?: string
    readonly toolInputSummary?: string
    readonly suggestionCount?: number
}

export type SetupMetadata = RequiredEventMetadata & {
    readonly trigger: string
}

export type MonitorMetadata = RequiredEventMetadata & EventSemanticMetadata & {
    readonly toolName: string
    readonly toolUseId?: string
    readonly monitorScript?: string
    readonly monitorDescription?: string
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

export type ContextSnapshotMetadata = RequiredEventMetadata & {
    readonly source?: string
    readonly threadId?: string
    readonly turnId?: string
    readonly contextWindowUsedPct?: number
    readonly contextWindowRemainingPct?: number
    readonly contextWindowTotalTokens?: number
    readonly contextWindowSize?: number
    readonly contextWindowInputTokens?: number
    readonly contextWindowOutputTokens?: number
    readonly contextWindowCacheCreationTokens?: number
    readonly contextWindowCacheReadTokens?: number
    readonly reasoningOutputTokens?: number
    readonly lastTurnInputTokens?: number
    readonly lastTurnOutputTokens?: number
    readonly lastTurnCachedInputTokens?: number
    readonly lastTurnReasoningOutputTokens?: number
    readonly rateLimitFiveHourUsedPct?: number
    readonly rateLimitFiveHourResetsAt?: number
    readonly rateLimitSevenDayUsedPct?: number
    readonly rateLimitSevenDayResetsAt?: number
    readonly rateLimitPrimaryUsedPct?: number
    readonly rateLimitPrimaryWindowDurationMins?: number
    readonly rateLimitPrimaryResetsAt?: number
    readonly rateLimitSecondaryUsedPct?: number
    readonly rateLimitSecondaryWindowDurationMins?: number
    readonly rateLimitSecondaryResetsAt?: number
    readonly costTotalUsd?: number
    readonly modelId?: string
    readonly modelProvider?: string
    readonly sessionVersion?: string
}
