import type {
    AgentActivityType,
    EventSubtypeGroup,
    EventSubtypeKey,
    EventToolFamily,
    EvidenceLevel,
    QuestionPhase,
    TodoState,
} from "~runtime/domain/ingest/model/event.model.js";
import type {CommandAnalysis} from "~runtime/domain/ingest/model/command.analysis.model.js";

/** 도구 이벤트가 어떤 행위였는지를 말하는 시맨틱 속성이다. */
export interface EventSemanticMetadata {
    readonly subtypeKey: EventSubtypeKey;
    readonly subtypeLabel?: string;
    readonly subtypeGroup?: EventSubtypeGroup;
    readonly toolFamily?: EventToolFamily;
    readonly operation?: string;
    readonly entityType?: string;
    readonly entityName?: string;
    readonly sourceTool?: string;
    readonly importance?: number;
}

/** 모든 이벤트가 싣는 근거 등급이다. */
export interface RequiredEventMetadata {
    readonly evidenceLevel: EvidenceLevel;
    readonly evidenceReason: string;
    readonly tags?: readonly string[];
}

export type TerminalCommandMetadata = RequiredEventMetadata & EventSemanticMetadata & {
    readonly toolName: string;
    readonly command: string;
    readonly description?: string;
    readonly toolUseId?: string;
    readonly commandAnalysis?: CommandAnalysis;
    readonly timeoutMs?: number;
    readonly runInBackground?: boolean;
    // 본문은 head와 tail로 잘리고 Bytes는 자르기 전 전체 바이트 수다.
    readonly exitCode?: number;
    readonly interrupted?: boolean;
    readonly stdout?: string;
    readonly stderr?: string;
    readonly stdoutBytes?: number;
    readonly stderrBytes?: number;
    readonly stdoutTruncated?: boolean;
    readonly stderrTruncated?: boolean;
};

export type ToolUsedMetadata = RequiredEventMetadata & EventSemanticMetadata & {
    readonly toolName: string;
    readonly filePath?: string;
    readonly relPath?: string;
    readonly toolInput?: Record<string, unknown>;
    readonly webUrls?: readonly string[];
    readonly toolUseId?: string;
    readonly readOffset?: number;
    readonly readLimit?: number;
    readonly searchPattern?: string;
    readonly searchPath?: string;
    readonly searchGlob?: string;
    readonly grepOutputMode?: "content" | "files_with_matches" | "count";
    readonly grepCaseInsensitive?: boolean;
    readonly grepMultiline?: boolean;
    readonly webQuery?: string;
    readonly webPrompt?: string;
    readonly webAllowedDomains?: readonly string[];
    readonly webBlockedDomains?: readonly string[];
    readonly editReplaceAll?: boolean;
    // resultMatches는 도구별 결과 건수이며 Grep은 매치 줄 수, Glob은 파일 수다.
    readonly resultText?: string;
    readonly resultBytes?: number;
    readonly resultTruncated?: boolean;
    readonly resultMatches?: number;
    readonly monitorScript?: string;
    readonly monitorDescription?: string;
};

export type AgentActivityMetadata = RequiredEventMetadata & EventSemanticMetadata & {
    readonly activityType: AgentActivityType;
    readonly mcpServer?: string;
    readonly mcpTool?: string;
    readonly agentName?: string;
    readonly agentModel?: string;
    readonly agentRunInBackground?: boolean;
    readonly skillName?: string;
    readonly toolInput?: Record<string, unknown>;
    readonly toolUseId?: string;
};

export type TodoLoggedMetadata = RequiredEventMetadata & {
    readonly todoId: string;
    readonly todoState: TodoState;
    readonly toolName?: string;
    readonly priority?: string;
    readonly status?: string;
    readonly autoReconciled?: boolean;
    readonly toolUseId?: string;
};

export type QuestionLoggedMetadata = RequiredEventMetadata & {
    readonly questionId: string;
    readonly questionPhase: QuestionPhase;
    readonly toolName?: string;
    readonly toolInput?: Record<string, unknown>;
    readonly options?: readonly string[];
    readonly toolUseId?: string;
};

export type PlanLoggedMetadata = RequiredEventMetadata & {
    readonly toolName?: string;
    readonly toolInput?: Record<string, unknown>;
    readonly planSource?: string;
    readonly toolUseId?: string;
};

export type ToolFailureMetadata = RequiredEventMetadata & Partial<EventSemanticMetadata> & {
    readonly failed: true;
    readonly error: string;
    readonly isInterrupt: boolean;
    readonly description?: string;
    readonly toolUseId?: string;
    readonly activityType?: AgentActivityType;
    readonly mcpServer?: string;
    readonly mcpTool?: string;
};
