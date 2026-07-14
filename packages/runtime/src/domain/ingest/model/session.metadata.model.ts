import type {
    RequiredEventMetadata,
} from "~runtime/domain/ingest/model/tool.metadata.model.js";
import type {
    TaskCompletionReason,
    UserMessageCaptureMode,
    UserMessagePhase,
} from "~runtime/domain/ingest/model/event.model.js";

export type ContextSavedMetadata = RequiredEventMetadata & {
    readonly trigger?: string;
    readonly compactPhase?: "before" | "after";
    readonly itemCount?: number;
    readonly toolUseId?: string;
};

export type AssistantResponseMetadata = RequiredEventMetadata & {
    readonly messageId: string;
    readonly source: string;
    readonly stopReason: string;
};

export type AssistantCommentaryMetadata = RequiredEventMetadata & {
    readonly messageId: string;
    readonly source: string;
    readonly phase: "commentary";
    readonly contentIndex?: number;
    readonly assistantUuid?: string;
    readonly parentUuid?: string;
    readonly requestId?: string;
    readonly sourceId?: string;
};

export type UserMessageMetadata = RequiredEventMetadata & {
    readonly messageId: string;
    readonly captureMode: UserMessageCaptureMode;
    readonly source: string;
    readonly phase: UserMessagePhase;
};

export type InstructionsLoadedMetadata = RequiredEventMetadata & {
    readonly filePath: string;
    readonly relPath: string;
    readonly loadReason: string;
    readonly memoryType: string;
};

export type UserPromptExpansionMetadata = RequiredEventMetadata & {
    readonly expansionType: string;
    readonly commandName: string;
    readonly commandArgs?: string;
    readonly commandSource?: string;
    readonly expandedPromptSnippet?: string;
    readonly expandedPromptBytes?: number;
};

export type FileChangedMetadata = RequiredEventMetadata & {
    readonly filePath: string;
    readonly relPath?: string;
};

export type WorktreeMetadata = RequiredEventMetadata & {
    readonly worktreePath: string;
    readonly relPath?: string;
    readonly worktreeAction: "create" | "remove";
};

export type PermissionRequestMetadata = RequiredEventMetadata & {
    readonly toolName: string;
    readonly toolUseId?: string;
    readonly toolInputSummary?: string;
    readonly suggestionCount?: number;
};

export type RuleLoggedMetadata = RequiredEventMetadata & {
    readonly ruleStatus?: string;
    readonly ruleOutcome?: string;
    readonly rulePolicy?: string;
    readonly ruleId?: string;
    readonly ruleSeverity?: string;
    readonly expectedPattern?: string;
    readonly actualToolCallCount?: number;
};

export type SetupMetadata = RequiredEventMetadata & {
    readonly trigger: string;
};

export type ActionLoggedMetadata = RequiredEventMetadata & {
    readonly asyncTaskId?: string;
    readonly asyncStatus?: string;
    readonly agentId?: string;
    readonly agentType?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly childTaskId?: string;
};

export type SessionEndedPayload = {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly summary: string;
    readonly completionReason: TaskCompletionReason;
    readonly completeTask?: boolean;
};

export type ContextSnapshotMetadata = RequiredEventMetadata & {
    readonly contextWindowUsedPct?: number;
    readonly contextWindowRemainingPct?: number;
    readonly contextWindowTotalTokens?: number;
    readonly contextWindowSize?: number;
    readonly contextWindowInputTokens?: number;
    readonly contextWindowOutputTokens?: number;
    readonly contextWindowCacheCreationTokens?: number;
    readonly contextWindowCacheReadTokens?: number;
    readonly rateLimitFiveHourUsedPct?: number;
    readonly rateLimitFiveHourResetsAt?: number;
    readonly rateLimitSevenDayUsedPct?: number;
    readonly rateLimitSevenDayResetsAt?: number;
    readonly costTotalUsd?: number;
    readonly modelId?: string;
    readonly sessionVersion?: string;
};
