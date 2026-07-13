/** OTel GenAI semantic conventions의 표준 속성 키이며 이 어휘의 리터럴은 여기 밖에 두지 않는다. */
export const SEMCONV_ATTR = {
    operationName: "gen_ai.operation.name",
    providerName: "gen_ai.provider.name",
    conversationId: "gen_ai.conversation.id",
    agentName: "gen_ai.agent.name",
    agentId: "gen_ai.agent.id",
    requestModel: "gen_ai.request.model",
    responseModel: "gen_ai.response.model",
    responseFinishReasons: "gen_ai.response.finish_reasons",
    inputTokens: "gen_ai.usage.input_tokens",
    outputTokens: "gen_ai.usage.output_tokens",
    cacheReadInputTokens: "gen_ai.usage.cache_read.input_tokens",
    cacheCreationInputTokens: "gen_ai.usage.cache_creation.input_tokens",
    tokenType: "gen_ai.token.type",
    toolName: "gen_ai.tool.name",
    toolType: "gen_ai.tool.type",
    toolCallId: "gen_ai.tool.call.id",
    outputType: "gen_ai.output.type",
    inputMessages: "gen_ai.input.messages",
    outputMessages: "gen_ai.output.messages",
    systemInstructions: "gen_ai.system_instructions",
    mcpMethodName: "mcp.method.name",
    mcpToolName: "mcp.tool.name",
    mcpSessionId: "mcp.session.id",
    errorType: "error.type",
} as const;

/** OTel semconv에 대응이 없는 제품 고유 속성 키다. */
export const AGENT_TRACER_ATTR = {
    jobId: "agent_tracer.job.id",
    jobKind: "agent_tracer.job.kind",
    backend: "agent_tracer.backend",
    runtimeSource: "agent_tracer.runtime.source",
    taskId: "agent_tracer.task.id",
    lane: "agent_tracer.lane",
    command: "agent_tracer.command",
    mcpServer: "agent_tracer.mcp.server",
    toolParametersFingerprint: "agent_tracer.tool.parameters.fingerprint",
    toolFamily: "agent_tracer.tool.family",
    subtypeKey: "agent_tracer.subtype.key",
    subtypeLabel: "agent_tracer.subtype.label",
    subtypeGroup: "agent_tracer.subtype.group",
    operation: "agent_tracer.operation",
    sourceTool: "agent_tracer.source_tool",
    entityType: "agent_tracer.entity.type",
    entityName: "agent_tracer.entity.name",
    displayTitle: "agent_tracer.display_title",
    evidenceLevel: "agent_tracer.evidence_level",
    evidenceReason: "agent_tracer.evidence_reason",
    filePaths: "agent_tracer.file_paths",
    durationMs: "agent_tracer.duration_ms",
    costUsd: "agent_tracer.cost_usd",
    asyncTaskId: "agent_tracer.async.task_id",
    asyncStatus: "agent_tracer.async.status",
    /** gen_ai.usage.input_tokens가 OTel 권고대로 cache 토큰을 포함한 총량이라, 과금 기준인 베이스 입력 토큰을 따로 싣는다. */
    billableBaseInputTokens: "agent_tracer.usage.billable_base_input_tokens",
    /** 늦게 도착한 commentary를 이미 닫힌 턴에 귀속시키는 상관키이며, 인과 부모와 별개다. */
    turnResponseEventId: "agent_tracer.turn.response_event_id",
    /** 직전 턴의 ID이며, 트레이스가 턴 단위로 갈리므로 OTLP span link로 이어 붙인다. */
    turnPreviousId: "agent_tracer.turn.previous_id",
} as const;

/** 턴 전체를 감싸는 invoke_agent span을 하위 조율 활동과 가르는 표식이다. */
export const TURN_ACTIVITY_TYPE = "turn";

/** semconv 구조화 메시지 한 건이며, 배열로 gen_ai.input/output.messages에 싣는다. */
export interface GenAiMessage {
    readonly role: string;
    readonly parts: readonly { readonly type: "text"; readonly content: string }[];
}

export function toGenAiMessage(role: string, text: string): GenAiMessage[] {
    return [{ role, parts: [{ type: "text", content: text }] }];
}

export const GEN_AI_OBSERVABILITY_METRIC = {
    clientTokenUsage: "gen_ai.client.token.usage",
    clientOperationDuration: "gen_ai.client.operation.duration",
    invokeAgentDuration: "gen_ai.invoke_agent.duration",
    executeToolDuration: "gen_ai.execute_tool.duration",
} as const;

export const GEN_AI_OPERATION = {
    invokeAgent: "invoke_agent",
    chat: "chat",
    executeTool: "execute_tool",
    plan: "plan",
} as const;

export type GenAiOperation = (typeof GEN_AI_OPERATION)[keyof typeof GEN_AI_OPERATION];

export const GEN_AI_PROVIDER = {
    anthropic: "anthropic",
} as const;

export type GenAiProvider = (typeof GEN_AI_PROVIDER)[keyof typeof GEN_AI_PROVIDER];

export const GEN_AI_TOKEN_TYPE = {
    input: "input",
    output: "output",
} as const;

export const GEN_AI_TOOL_TYPE = {
    function: "function",
    datastore: "datastore",
} as const;

// 원장이 정규화된 속성만 담도록 훅의 내부 키를 저장 전에 표준 이름으로 올린다.
const ATTRIBUTE_PROMOTION: Readonly<Record<string, string>> = {
    toolName: SEMCONV_ATTR.toolName,
    agentName: SEMCONV_ATTR.agentName,
    agentModel: SEMCONV_ATTR.requestModel,
    model: SEMCONV_ATTR.requestModel,
    mcpTool: SEMCONV_ATTR.mcpToolName,
    inputTokens: SEMCONV_ATTR.inputTokens,
    outputTokens: SEMCONV_ATTR.outputTokens,
    cacheReadTokens: SEMCONV_ATTR.cacheReadInputTokens,
    cacheCreateTokens: SEMCONV_ATTR.cacheCreationInputTokens,
    stopReason: SEMCONV_ATTR.responseFinishReasons,
    mcpServer: AGENT_TRACER_ATTR.mcpServer,
    command: AGENT_TRACER_ATTR.command,
    costUsd: AGENT_TRACER_ATTR.costUsd,
    durationMs: AGENT_TRACER_ATTR.durationMs,
    evidenceLevel: AGENT_TRACER_ATTR.evidenceLevel,
    evidenceReason: AGENT_TRACER_ATTR.evidenceReason,
    filePaths: AGENT_TRACER_ATTR.filePaths,
    subtypeKey: AGENT_TRACER_ATTR.subtypeKey,
    subtypeLabel: AGENT_TRACER_ATTR.subtypeLabel,
    subtypeGroup: AGENT_TRACER_ATTR.subtypeGroup,
    toolFamily: AGENT_TRACER_ATTR.toolFamily,
    operation: AGENT_TRACER_ATTR.operation,
    sourceTool: AGENT_TRACER_ATTR.sourceTool,
    entityType: AGENT_TRACER_ATTR.entityType,
    entityName: AGENT_TRACER_ATTR.entityName,
    displayTitle: AGENT_TRACER_ATTR.displayTitle,
    asyncTaskId: AGENT_TRACER_ATTR.asyncTaskId,
    asyncStatus: AGENT_TRACER_ATTR.asyncStatus,
    turnResponseEventId: AGENT_TRACER_ATTR.turnResponseEventId,
};

export function promoteAttributeKey(key: string): string {
    return ATTRIBUTE_PROMOTION[key] ?? key;
}

export function toSemconvAttributes(metadata: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const promoted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) promoted[promoteAttributeKey(key)] = value;
    return promoted;
}
