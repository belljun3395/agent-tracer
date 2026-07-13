import { isSpanEventKind, KIND } from "~kernel/ingest/event.kind.const.js";
import { baseAttributes, readString, toKeyValues } from "./attributes.js";
import { groupByTask, nanos, OTLP_SCOPE_NAME, resourceOf } from "./common.js";
import type { OtlpEventRecord } from "./model.js";

const SEVERITY_INFO = 9;
const SEVERITY_ERROR = 17;

function toLogRecord(record: OtlpEventRecord): Record<string, unknown> {
    const attributes = baseAttributes(record);
    attributes["event.name"] = record.kind;
    const body = readString(record.payload, "body") ?? readString(record.payload, "title") ?? "";
    const failed = record.kind === KIND.taskError;
    const timestamp = nanos(record.occurredAt.getTime());
    return {
        timeUnixNano: timestamp,
        observedTimeUnixNano: timestamp,
        severityNumber: failed ? SEVERITY_ERROR : SEVERITY_INFO,
        severityText: failed ? "ERROR" : "INFO",
        body: { stringValue: body },
        attributes: toKeyValues(attributes),
        traceId: record.traceId,
        spanId: record.parentSpanId ?? record.spanId,
    };
}

export function buildOtlpLogsBody(records: readonly OtlpEventRecord[]): Record<string, unknown> | null {
    const logRecords = records.filter((record) => !isSpanEventKind(record.kind));
    if (logRecords.length === 0) return null;
    const resourceLogs = [...groupByTask(logRecords)].map(([taskId, group]) => ({
        resource: resourceOf(taskId),
        scopeLogs: [{ scope: { name: OTLP_SCOPE_NAME }, logRecords: group.map((record) => toLogRecord(record)) }],
    }));
    return { resourceLogs };
}
