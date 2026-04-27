import { readFilePaths, readString } from "~domain/monitoring/event/event.metadata.js";
import {
    isAgentActivityLoggedEvent,
    isExplorationLane,
    isImplementationLane,
    isLlmInteractionEvent,
    isPlanningLane,
    isToolActivityEvent,
} from "~domain/monitoring/event/event.predicates.js";
import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import type { MonitoringTask } from "~domain/monitoring/task/model/task.model.js";
import { META } from "~domain/runtime/const/metadata.keys.const.js";

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

const OI_ATTRS = {
    spanKind: "openinference.span.kind",
    eventKind: "ai.monitor.event.kind",
    eventLane: "ai.monitor.event.lane",
    sessionId: "session.id",
    genAiSystem: "gen_ai.system",
    toolName: "tool.name",
    ruleId: "rule.id",
    ruleStatus: "rule.status",
    rulePolicy: "rule.policy",
    ruleOutcome: "rule.outcome",
    activityType: "agent.activity.type",
    asyncTaskId: "agent.async_task.id",
    questionId: "question.id",
    todoId: "todo.id",
    captureMode: "message.capture_mode",
    filePaths: "file.paths",
} as const;

/**
 * Domain model — projects a task and its timeline of events into the
 * OpenInference span export format. Encapsulates the rules for span kind
 * classification and attribute mapping in one place.
 */
export class TaskOpenInferenceExport {
    constructor(
        private readonly task: MonitoringTask,
        private readonly timeline: readonly TimelineEvent[],
    ) {}

    toRecord(): OpenInferenceTaskExport {
        return {
            taskId: this.task.id,
            ...(this.task.runtimeSource ? { runtimeSource: this.task.runtimeSource } : {}),
            spans: this.timeline.map((event) => this.toSpan(event)),
        };
    }

    private toSpan(event: TimelineEvent): OpenInferenceSpanRecord {
        const parentSpanId = readString(event.metadata, META.parentEventId)
            ?? readString(event.metadata, META.sourceEventId);
        const kind = classifySpanKind(event);
        return {
            spanId: event.id,
            ...(parentSpanId ? { parentSpanId } : {}),
            name: event.title || event.kind,
            kind,
            startTime: event.createdAt,
            attributes: {
                [OI_ATTRS.spanKind]: kind,
                [OI_ATTRS.eventKind]: event.kind,
                [OI_ATTRS.eventLane]: event.lane,
                ...(event.sessionId ? { [OI_ATTRS.sessionId]: event.sessionId } : {}),
                ...(this.task.runtimeSource ? { [OI_ATTRS.genAiSystem]: this.task.runtimeSource } : {}),
                ...collectAttributeHints(event),
            },
        };
    }
}

function classifySpanKind(event: TimelineEvent): OpenInferenceSpanKind {
    if (isLlmInteractionEvent(event)) return "LLM";
    if (isToolActivityEvent(event)) return "TOOL";
    if (isAgentActivityLoggedEvent(event)) return "AGENT";
    if (isExplorationLane(event.lane)) return "RETRIEVER";
    if (isPlanningLane(event.lane) || isImplementationLane(event.lane)
        || event.kind === "plan.logged" || event.kind === "action.logged") {
        return "CHAIN";
    }
    return "UNKNOWN";
}

function collectAttributeHints(event: TimelineEvent): Record<string, unknown> {
    const hints: Record<string, unknown> = {};
    const copyKey = (sourceKey: string, targetKey: string): void => {
        const value = event.metadata[sourceKey];
        if (value !== undefined) hints[targetKey] = value;
    };
    copyKey(META.toolName, OI_ATTRS.toolName);
    copyKey(META.ruleId, OI_ATTRS.ruleId);
    copyKey(META.ruleStatus, OI_ATTRS.ruleStatus);
    copyKey(META.rulePolicy, OI_ATTRS.rulePolicy);
    copyKey(META.ruleOutcome, OI_ATTRS.ruleOutcome);
    copyKey(META.activityType, OI_ATTRS.activityType);
    copyKey(META.asyncTaskId, OI_ATTRS.asyncTaskId);
    copyKey(META.questionId, OI_ATTRS.questionId);
    copyKey(META.todoId, OI_ATTRS.todoId);
    copyKey(META.captureMode, OI_ATTRS.captureMode);
    const filePaths = readFilePaths(event.metadata);
    if (filePaths.length > 0) hints[OI_ATTRS.filePaths] = filePaths;
    return hints;
}
