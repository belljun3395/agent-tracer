import { Inject, Injectable } from "@nestjs/common";
import { KIND, LANE, TOOL_ACTIVITY_EVENT_KINDS } from "@monitor/kernel";
import type { OpenInferenceSpanKind, OpenInferenceSpanRecord, OpenInferenceTaskExport } from "@monitor/kernel";
import type { EventEntity } from "@monitor/tracer-domain";
import { EVENT_READER, type EventReaderPort } from "~tracer-api/domain/task/port/event.reader.port.js";
import { TASK_REPOSITORY, type TaskRepositoryPort } from "~tracer-api/domain/task/port/task.repository.port.js";

const PAGE_SIZE = 500;
const TOOL_ACTIVITY_KIND_SET = new Set<string>(TOOL_ACTIVITY_EVENT_KINDS);

type SpanKind = OpenInferenceSpanKind;
type SpanRecord = OpenInferenceSpanRecord;

export type OpenInferenceExport = OpenInferenceTaskExport;

@Injectable()
export class ExportOpenInferenceUseCase {
    constructor(
        @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepositoryPort,
        @Inject(EVENT_READER) private readonly events: EventReaderPort,
    ) {}

    async execute(userId: string, taskId: string): Promise<{ readonly openinference: OpenInferenceExport } | null> {
        const task = await this.tasks.findById(taskId);
        // 남의 작업은 존재 여부도 드러내지 않는다.
        if (task === null || !task.isOwnedBy(userId)) return null;

        const genAiSystem = task.cliSource ?? undefined;
        const spans: SpanRecord[] = [];
        let cursor: { seq: string } | undefined;
        for (;;) {
            const page = await this.events.findTimeline(taskId, cursor, PAGE_SIZE);
            for (const event of page) spans.push(toSpan(event, genAiSystem));
            if (page.length < PAGE_SIZE) break;
            const last = page.at(-1);
            if (last === undefined) break;
            cursor = { seq: last.seq };
        }
        return { openinference: { taskId, spans } };
    }
}

function toSpan(event: EventEntity, genAiSystem: string | undefined): SpanRecord {
    const parentSpanId = readString(event.metadata, "parentEventId") ?? readString(event.metadata, "sourceEventId");
    const kind = classifySpanKind(event);
    return {
        spanId: event.id,
        ...(parentSpanId !== undefined ? { parentSpanId } : {}),
        name: event.title.length > 0 ? event.title : event.kind,
        kind,
        startTime: event.occurredAt.toISOString(),
        attributes: {
            "openinference.span.kind": kind,
            "ai.monitor.event.kind": event.kind,
            "ai.monitor.event.lane": event.lane,
            ...(event.sessionId !== null ? { "session.id": event.sessionId } : {}),
            ...(genAiSystem !== undefined ? { "gen_ai.system": genAiSystem } : {}),
            ...(event.toolName !== null ? { "tool.name": event.toolName } : {}),
            ...(event.filePaths.length > 0 ? { "file.paths": event.filePaths } : {}),
        },
    };
}

function classifySpanKind(event: EventEntity): SpanKind {
    if (event.kind === KIND.userMessage || event.kind === KIND.assistantCommentary
        || event.kind === KIND.assistantResponse) return "LLM";
    if (TOOL_ACTIVITY_KIND_SET.has(event.kind)) return "TOOL";
    if (event.kind === KIND.invokeAgent) return "AGENT";
    if (event.lane === LANE.exploration) return "RETRIEVER";
    if (event.lane === LANE.planning || event.lane === LANE.implementation
        || event.kind === KIND.planLogged || event.kind === KIND.actionLogged) {
        return "CHAIN";
    }
    return "UNKNOWN";
}

function readString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
