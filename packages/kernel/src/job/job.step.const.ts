export const AI_JOB_STEP_ROLE = {
    system: "system",
    user: "user",
    assistant: "assistant",
    tool: "tool",
    graph: "graph",
} as const;

export type AiJobStepRole = (typeof AI_JOB_STEP_ROLE)[keyof typeof AI_JOB_STEP_ROLE];

export const AI_JOB_STEP_ROLES = [
    AI_JOB_STEP_ROLE.system,
    AI_JOB_STEP_ROLE.user,
    AI_JOB_STEP_ROLE.assistant,
    AI_JOB_STEP_ROLE.tool,
    AI_JOB_STEP_ROLE.graph,
] as const satisfies readonly AiJobStepRole[];

export const AI_JOB_GRAPH_EVENT_KIND = {
    nodeStarted: "node.started",
    nodeCompleted: "node.completed",
    nodeFailed: "node.failed",
    routeSelected: "route.selected",
    validationFailed: "validation.failed",
} as const;

export type AiJobGraphEventKind = (typeof AI_JOB_GRAPH_EVENT_KIND)[keyof typeof AI_JOB_GRAPH_EVENT_KIND];

export interface AiJobStepToolCall {
    readonly id: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

// langgraph-agents의 AgentStepDTO(agents/shared/models.py)와 필드가 1:1 대응한다.
export interface AiJobStepPayload {
    readonly seq: number;
    readonly role: AiJobStepRole;
    readonly content: string;
    readonly truncated: boolean;
    readonly toolCalls: readonly AiJobStepToolCall[];
    readonly toolName?: string | undefined;
    readonly toolCallId?: string | undefined;
    readonly inputTokens?: number | undefined;
    readonly outputTokens?: number | undefined;
    readonly cacheReadTokens?: number | undefined;
    readonly cacheCreationTokens?: number | undefined;
    readonly stopReason?: string | undefined;
    readonly nodeName?: string | undefined;
    readonly eventKind?: AiJobGraphEventKind | undefined;
    readonly durationMs?: number | undefined;
}

export interface AiJobRecordedStep extends AiJobStepPayload {
    readonly attempt: number;
}

export type AiJobStepList = readonly AiJobRecordedStep[];

// 백엔드가 실제로 내보내는 빈 스텝은 궤적에 아무 의미도 싣지 못하므로 저장하지 않는다.
export function aiJobStepCarriesContent(step: AiJobStepPayload): boolean {
    return step.content.trim().length > 0 || step.toolCalls.length > 0;
}
