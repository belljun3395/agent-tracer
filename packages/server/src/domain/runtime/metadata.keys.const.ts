// Metadata field names written by the runtime and read by the server.
// These are the keys inside TimelineEvent.metadata / ingest payloads.

export const META = {
    subtypeKey: "subtypeKey",
    subtypeLabel: "subtypeLabel",
    subtypeGroup: "subtypeGroup",
    toolFamily: "toolFamily",
    operation: "operation",
    entityType: "entityType",
    entityName: "entityName",
    sourceTool: "sourceTool",
    importance: "importance",

    toolName: "toolName",
    command: "command",
    writeCount: "writeCount",

    parentEventId: "parentEventId",
    sourceEventId: "sourceEventId",

    filePaths: "filePaths",
    filePath: "filePath",
    displayTitle: "displayTitle",

    ruleId: "ruleId",
    ruleStatus: "ruleStatus",
    rulePolicy: "rulePolicy",
    ruleOutcome: "ruleOutcome",
    verificationStatus: "verificationStatus",

    activityType: "activityType",
    asyncTaskId: "asyncTaskId",

    questionId: "questionId",
    questionPhase: "questionPhase",
    todoId: "todoId",
    todoState: "todoState",
    priority: "priority",
    status: "status",
    autoReconciled: "autoReconciled",
    captureMode: "captureMode",

    evidenceLevel: "evidenceLevel",
    evidenceReason: "evidenceReason",
    inputTokens: "inputTokens",
    outputTokens: "outputTokens",
    cacheReadTokens: "cacheReadTokens",
    cacheCreateTokens: "cacheCreateTokens",
    costUsd: "costUsd",
    durationMs: "durationMs",
    model: "model",
    promptId: "promptId",
} as const;
