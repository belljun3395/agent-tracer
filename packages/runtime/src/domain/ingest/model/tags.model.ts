const TAG_KEYS: readonly (readonly [string, string])[] = [
    ["ruleId", "rule"],
    ["ruleStatus", "rule-status"],
    ["verificationStatus", "verification"],
    ["severity", "severity"],
    ["rulePolicy", "policy"],
    ["ruleOutcome", "outcome"],
    ["asyncStatus", "async"],
    ["asyncAgent", "agent"],
    ["asyncCategory", "category"],
    ["activityType", "activity"],
    ["subtypeKey", "subtype"],
    ["subtypeGroup", "subtype-group"],
    ["entityType", "entity"],
    ["toolFamily", "tool-family"],
    ["operation", "operation"],
    ["sourceTool", "source-tool"],
    ["agentName", "agent"],
    ["skillName", "skill"],
    ["ruleSource", "source"],
    ["questionPhase", "question"],
    ["todoState", "todo"],
    ["modelName", "model"],
    ["modelProvider", "provider"],
    ["mcpServer", "mcp"],
    ["mcpTool", "mcp-tool"],
    ["compactPhase", "compact"],
];

const FLAG_KEYS: readonly (readonly [string, string])[] = [
    ["asyncTaskId", "async-task"],
    ["questionId", "question"],
    ["todoId", "todo"],
];

function normalizeTag(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function readTagValue(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number") return String(value);
    return undefined;
}

/** 메타데이터에서 이벤트 검색에 쓰는 `key:value` 태그를 만든다. */
export function buildTagsFromMetadata(metadata: Record<string, unknown>): readonly string[] {
    const tags = new Set<string>();
    for (const [key, prefix] of TAG_KEYS) {
        const value = readTagValue(metadata, key);
        if (value) tags.add(`${prefix}:${normalizeTag(value)}`);
    }
    for (const [key, tag] of FLAG_KEYS) {
        if (readTagValue(metadata, key)) tags.add(tag);
    }
    const importance = readTagValue(metadata, "importance");
    if (importance) tags.add(`importance:${normalizeTag(importance)}`);
    return [...tags];
}

/** 메타데이터에 계산된 tags 속성을 붙여 돌려준다. */
export function withTags<T extends object>(metadata: T): T & {readonly tags: readonly string[]} {
    return {...metadata, tags: buildTagsFromMetadata(metadata as Record<string, unknown>)};
}
