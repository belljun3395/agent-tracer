import type { TodoState, QuestionPhase } from "./event.kind.js";
import type { EvidenceLevel, AgentActivityType } from "./task.status.js";
import type { EventSubtypeGroup, EventToolFamily } from "../runtime/event.subtype.keys.js";
import type { AllEventSubtypeKey } from "./subtype.registry.js";

export interface BaseEventMetadata {
    readonly subtypeKey?: AllEventSubtypeKey;
    readonly subtypeLabel?: string;
    readonly subtypeGroup?: EventSubtypeGroup;
    readonly toolFamily?: EventToolFamily;
    readonly operation?: string;
    readonly entityType?: string;
    readonly entityName?: string;
    readonly sourceTool?: string;
    readonly filePaths?: readonly string[];
    readonly filePath?: string;
    readonly displayTitle?: string;
    readonly evidenceLevel?: EvidenceLevel;
    readonly parentEventId?: string;
    readonly sourceEventId?: string;
    readonly asyncTaskId?: string;
    readonly [key: string]: unknown;
}

export interface TokenUsageMetadata extends BaseEventMetadata {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens?: number;
    readonly cacheCreateTokens?: number;
    readonly costUsd?: number;
    readonly durationMs?: number;
    readonly model?: string;
    readonly promptId?: string;
    readonly source?: string;
}

export interface RuleGuardMetadata extends BaseEventMetadata {
    readonly ruleId?: string;
    readonly ruleStatus?: string;
    readonly rulePolicy?: string;
    readonly ruleOutcome?: string;
    readonly verificationStatus?: string;
}

export interface VerificationLoggedMetadata extends BaseEventMetadata {
    readonly verificationStatus?: string;
    readonly ruleId?: string;
}

export interface TodoLoggedMetadata extends BaseEventMetadata {
    readonly todoId?: string;
    readonly todoState?: TodoState;
    readonly toolName?: string;
    readonly priority?: string;
    readonly status?: string;
    readonly autoReconciled?: boolean;
}

export interface QuestionLoggedMetadata extends BaseEventMetadata {
    readonly questionId?: string;
    readonly questionPhase?: QuestionPhase;
}

export interface UserMessageMetadata extends BaseEventMetadata {
    readonly captureMode?: "raw" | "derived";
    readonly phase?: "initial" | "follow_up";
    readonly questionPhase?: QuestionPhase;
    readonly questionId?: string;
}

export interface FileChangeMetadata extends BaseEventMetadata {
    readonly writeCount?: number;
    readonly filePath?: string;
    readonly filePaths?: readonly string[];
    readonly sourceKind?: string;
}

export interface AgentActivityMetadata extends BaseEventMetadata {
    readonly activityType?: AgentActivityType;
    readonly agentName?: string;
    readonly skillName?: string;
    readonly skillPath?: string;
    readonly mcpServer?: string;
    readonly mcpTool?: string;
    readonly relationLabel?: string;
    readonly relationExplanation?: string;
}

export interface ToolActivityMetadata extends BaseEventMetadata {
    readonly toolName?: string;
    readonly command?: string;
}

export interface TaskStartMetadata extends BaseEventMetadata {
    readonly taskKind?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
}

export interface EventSemanticMetadata {
    readonly subtypeKey: AllEventSubtypeKey;
    readonly subtypeLabel?: string;
    readonly subtypeGroup: EventSubtypeGroup;
    readonly toolFamily: EventToolFamily;
    readonly operation: string;
    readonly entityType?: string;
    readonly entityName?: string;
    readonly sourceTool?: string;
    readonly importance?: string;
}
