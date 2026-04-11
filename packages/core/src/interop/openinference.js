/**
 * Converts a task timeline into an OpenInference-shaped export payload.
 */
export function buildOpenInferenceTaskExport(task, timeline) {
    return {
        taskId: task.id,
        ...(task.runtimeSource ? { runtimeSource: task.runtimeSource } : {}),
        spans: timeline.map((event) => buildOpenInferenceSpanRecord(task.runtimeSource, event))
    };
}
/**
 * Maps a single timeline event to an OpenInference span with monitor-specific attributes.
 */
export function buildOpenInferenceSpanRecord(runtimeSource, event) {
    const parentSpanId = extractString(event.metadata, "parentEventId")
        ?? extractString(event.metadata, "sourceEventId");
    const kind = mapEventToOpenInferenceKind(event);
    return {
        spanId: event.id,
        ...(parentSpanId ? { parentSpanId } : {}),
        name: event.title || event.kind,
        kind,
        startTime: event.createdAt,
        attributes: {
            "openinference.span.kind": kind,
            "ai.monitor.event.kind": event.kind,
            "ai.monitor.event.lane": event.lane,
            ...(event.sessionId ? { "session.id": event.sessionId } : {}),
            ...(runtimeSource ? { "gen_ai.system": mapRuntimeSourceToGenAiSystem(runtimeSource) } : {}),
            ...collectAttributeHints(event)
        }
    };
}
/**
 * Chooses the closest OpenInference span kind for a monitor timeline event.
 */
function mapEventToOpenInferenceKind(event) {
    if (event.kind === "assistant.response" || event.kind === "user.message") {
        return "LLM";
    }
    if (event.kind === "tool.used" || event.kind === "terminal.command") {
        return "TOOL";
    }
    if (event.kind === "agent.activity.logged") {
        return "AGENT";
    }
    if (event.lane === "exploration") {
        return "RETRIEVER";
    }
    if (event.lane === "planning" || event.lane === "implementation" || event.kind === "plan.logged" || event.kind === "action.logged") {
        return "CHAIN";
    }
    return "UNKNOWN";
}
/**
 * Translates runtime identifiers into the provider label expected by OpenInference consumers.
 */
function mapRuntimeSourceToGenAiSystem(runtimeSource) {
    const normalized = runtimeSource.toLowerCase();
    if (normalized.includes("claude"))
        return "anthropic";
    return normalized;
}
/**
 * Copies event metadata into the attribute names used by the export format.
 */
function collectAttributeHints(event) {
    const hints = {};
    const copyKey = (sourceKey, targetKey) => {
        const value = event.metadata[sourceKey];
        if (value !== undefined) {
            hints[targetKey] = value;
        }
    };
    copyKey("toolName", "tool.name");
    copyKey("ruleId", "rule.id");
    copyKey("ruleStatus", "rule.status");
    copyKey("rulePolicy", "rule.policy");
    copyKey("ruleOutcome", "rule.outcome");
    copyKey("activityType", "agent.activity.type");
    copyKey("asyncTaskId", "agent.async_task.id");
    copyKey("questionId", "question.id");
    copyKey("todoId", "todo.id");
    copyKey("captureMode", "message.capture_mode");
    const filePaths = event.metadata["filePaths"];
    if (Array.isArray(filePaths) && filePaths.length > 0) {
        hints["file.paths"] = filePaths;
    }
    return hints;
}
/**
 * Reads an event id-like string from metadata when present.
 */
function extractString(metadata, key) {
    const value = metadata[key];
    return typeof value === "string" ? value : undefined;
}
//# sourceMappingURL=openinference.js.map