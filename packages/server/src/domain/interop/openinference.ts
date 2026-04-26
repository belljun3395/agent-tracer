import {
    isAgentActivityLoggedEvent,
    isExplorationLane,
    isImplementationLane,
    isLlmInteractionEvent,
    isPlanningLane,
    isToolActivityEvent,
    META,
    readFilePaths,
    readString,
    type MonitoringTask,
    type TimelineEvent,
} from "~domain/index.js";

export type OpenInferenceSpanKind = "AGENT" | "CHAIN" | "TOOL" | "LLM" | "RETRIEVER" | "UNKNOWN";
export interface OpenInferenceSpanRecord {
    readonly spanId: string;
    readonly parentSpanId?: string;
    readonly name: string;
    readonly kind: OpenInferenceSpanKind;
    readonly startTime: string;
    readonly attributes: Record<string, unknown>;
}
export interface OpenInferenceTaskExport {
    readonly taskId: string;
    readonly runtimeSource?: string;
    readonly spans: readonly OpenInferenceSpanRecord[];
}

// OpenInference / ai.monitor span attribute names (output format).
const OI_ATTRS = {
    spanKind:      "openinference.span.kind",
    eventKind:     "ai.monitor.event.kind",
    eventLane:     "ai.monitor.event.lane",
    sessionId:     "session.id",
    genAiSystem:   "gen_ai.system",
    toolName:      "tool.name",
    ruleId:        "rule.id",
    ruleStatus:    "rule.status",
    rulePolicy:    "rule.policy",
    ruleOutcome:   "rule.outcome",
    activityType:  "agent.activity.type",
    asyncTaskId:   "agent.async_task.id",
    questionId:    "question.id",
    todoId:        "todo.id",
    captureMode:   "message.capture_mode",
    filePaths:     "file.paths",
} as const;

export function buildOpenInferenceTaskExport(task: MonitoringTask, timeline: readonly TimelineEvent[]): OpenInferenceTaskExport {
    return {
        taskId: task.id,
        ...(task.runtimeSource ? { runtimeSource: task.runtimeSource } : {}),
        spans: timeline.map((event) => buildOpenInferenceSpanRecord(task.runtimeSource, event))
    };
}

export function buildOpenInferenceSpanRecord(runtimeSource: string | undefined, event: TimelineEvent): OpenInferenceSpanRecord {
    const parentSpanId = readString(event.metadata, META.parentEventId)
        ?? readString(event.metadata, META.sourceEventId);
    const kind = mapEventToOpenInferenceKind(event);
    return {
        spanId: event.id,
        ...(parentSpanId ? { parentSpanId } : {}),
        name: event.title || event.kind,
        kind,
        startTime: event.createdAt,
        attributes: {
            [OI_ATTRS.spanKind]:  kind,
            [OI_ATTRS.eventKind]: event.kind,
            [OI_ATTRS.eventLane]: event.lane,
            ...(event.sessionId ? { [OI_ATTRS.sessionId]: event.sessionId } : {}),
            ...(runtimeSource ? { [OI_ATTRS.genAiSystem]: runtimeSource } : {}),
            ...collectAttributeHints(event)
        }
    };
}

function mapEventToOpenInferenceKind(event: TimelineEvent): OpenInferenceSpanKind {
    if (isLlmInteractionEvent(event)) {
        return "LLM";
    }
    if (isToolActivityEvent(event)) {
        return "TOOL";
    }
    if (isAgentActivityLoggedEvent(event)) {
        return "AGENT";
    }
    if (isExplorationLane(event.lane)) {
        return "RETRIEVER";
    }
    if (isPlanningLane(event.lane) || isImplementationLane(event.lane) || event.kind === "plan.logged" || event.kind === "action.logged") {
        return "CHAIN";
    }
    return "UNKNOWN";
}

function collectAttributeHints(event: TimelineEvent): Record<string, unknown> {
    const hints: Record<string, unknown> = {};
    const copyKey = (sourceKey: string, targetKey: string): void => {
        const value = event.metadata[sourceKey];
        if (value !== undefined) {
            hints[targetKey] = value;
        }
    };
    copyKey(META.toolName,     OI_ATTRS.toolName);
    copyKey(META.ruleId,       OI_ATTRS.ruleId);
    copyKey(META.ruleStatus,   OI_ATTRS.ruleStatus);
    copyKey(META.rulePolicy,   OI_ATTRS.rulePolicy);
    copyKey(META.ruleOutcome,  OI_ATTRS.ruleOutcome);
    copyKey(META.activityType, OI_ATTRS.activityType);
    copyKey(META.asyncTaskId,  OI_ATTRS.asyncTaskId);
    copyKey(META.questionId,   OI_ATTRS.questionId);
    copyKey(META.todoId,       OI_ATTRS.todoId);
    copyKey(META.captureMode,  OI_ATTRS.captureMode);
    const filePaths = readFilePaths(event.metadata);
    if (filePaths.length > 0) {
        hints[OI_ATTRS.filePaths] = filePaths;
    }
    return hints;
}
