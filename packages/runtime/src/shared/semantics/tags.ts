function extractStr(meta: Record<string, unknown>, key: string): string | undefined {
    const v = meta[key]; return typeof v === "string" ? v : undefined;
}

function extractBool(meta: Record<string, unknown>, key: string): boolean {
    return meta[key] === true;
}

function extractStrArray(meta: Record<string, unknown>, key: string): readonly string[] {
    const v = meta[key]; if (!Array.isArray(v)) return [];
    return v.filter((e): e is string => typeof e === "string");
}

function normalizeTag(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Scans known metadata fields and emits normalized `key:value` tag strings. Callers use the result to attach searchable tags to ingest events. */
export function buildTagsFromMetadata(meta: Record<string, unknown>): readonly string[] {
    const tags = new Set<string>();
    const add = (tag: string) => tags.add(tag);
    const str = (key: string) => extractStr(meta, key);
    const strArr = (key: string) => extractStrArray(meta, key);
    const bool = (key: string) => extractBool(meta, key);

    const ruleId = str("ruleId"); if (ruleId) add(`rule:${normalizeTag(ruleId)}`);
    const ruleStatus = str("ruleStatus"); if (ruleStatus) add(`status:${normalizeTag(ruleStatus)}`);
    const verificationStatus = str("verificationStatus"); if (verificationStatus) add(`status:${normalizeTag(verificationStatus)}`);
    const severity = str("severity"); if (severity) add(`severity:${normalizeTag(severity)}`);
    const rulePolicy = str("rulePolicy"); if (rulePolicy) add(`policy:${normalizeTag(rulePolicy)}`);
    const ruleOutcome = str("ruleOutcome"); if (ruleOutcome) add(`outcome:${normalizeTag(ruleOutcome)}`);
    const asyncTaskId = str("asyncTaskId"); if (asyncTaskId) add("async-task");
    const asyncStatus = str("asyncStatus"); if (asyncStatus) { add(`async:${normalizeTag(asyncStatus)}`); add(`status:${normalizeTag(asyncStatus)}`); }
    const asyncAgent = str("asyncAgent"); if (asyncAgent) add(`agent:${normalizeTag(asyncAgent)}`);
    const asyncCategory = str("asyncCategory"); if (asyncCategory) add(`category:${normalizeTag(asyncCategory)}`);
    const activityType = str("activityType"); if (activityType) { add("coordination"); add(`activity:${normalizeTag(activityType)}`); }
    const subtypeKey = str("subtypeKey"); if (subtypeKey) add(`subtype:${normalizeTag(subtypeKey)}`);
    const subtypeGroup = str("subtypeGroup"); if (subtypeGroup) add(`subtype-group:${normalizeTag(subtypeGroup)}`);
    const entityType = str("entityType"); if (entityType) add(`entity:${normalizeTag(entityType)}`);
    const toolFamily = str("toolFamily"); if (toolFamily) add(`tool-family:${normalizeTag(toolFamily)}`);
    const operation = str("operation"); if (operation) add(`operation:${normalizeTag(operation)}`);
    const sourceTool = str("sourceTool"); if (sourceTool) add(`source-tool:${normalizeTag(sourceTool)}`);
    const importance = str("importance"); if (importance) add(`importance:${normalizeTag(importance)}`);
    const agentName = str("agentName"); if (agentName) add(`agent:${normalizeTag(agentName)}`);
    const skillName = str("skillName"); if (skillName) add(`skill:${normalizeTag(skillName)}`);
    const ruleSource = str("ruleSource"); if (ruleSource) add(`source:${normalizeTag(ruleSource)}`);
    const questionId = str("questionId"); if (questionId) add("question");
    const questionPhase = str("questionPhase"); if (questionPhase) add(`question:${normalizeTag(questionPhase)}`);
    const todoId = str("todoId"); if (todoId) add("todo");
    const todoState = str("todoState"); if (todoState) add(`todo:${normalizeTag(todoState)}`);
    const modelName = str("modelName"); if (modelName) add(`model:${normalizeTag(modelName)}`);
    const modelProvider = str("modelProvider"); if (modelProvider) add(`provider:${normalizeTag(modelProvider)}`);
    const mcpServer = str("mcpServer"); if (mcpServer) add(`mcp:${normalizeTag(mcpServer)}`);
    const mcpTool = str("mcpTool"); if (mcpTool) add(`mcp-tool:${normalizeTag(mcpTool)}`);
    const relationType = str("relationType"); if (relationType) add(`relation:${normalizeTag(relationType)}`);
    if (bool("compactEvent")) add("compact");
    const compactPhase = str("compactPhase"); if (compactPhase) add(`compact:${normalizeTag(compactPhase)}`);
    const compactEventType = str("compactEventType"); if (compactEventType) add(`compact:${normalizeTag(compactEventType)}`);
    for (const s of strArr("compactSignals")) add(`compact:${normalizeTag(s)}`);
    return [...tags];
}

/** Spreads the input object and appends a `tags` property computed by `buildTagsFromMetadata`. Returns the augmented object as a new type. */
export function withTags<T extends object>(meta: T): T & { readonly tags: readonly string[] } {
    return { ...meta, tags: buildTagsFromMetadata(meta as Record<string, unknown>) };
}
