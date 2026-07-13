import { KIND, isSpanEventKind } from "~kernel/ingest/event.kind.const.js";
import { AGENT_TRACER_ATTR, GEN_AI_OPERATION, SEMCONV_ATTR } from "../semconv.const.js";
import { baseAttributes, readString, toKeyValues } from "./attributes.js";
import { groupByTask, nanos, OTLP_SCOPE_NAME, resourceOf } from "./common.js";
import { spanIdOf, traceIdOf } from "./identity.js";
import type { OtlpEventRecord } from "./model.js";

const SPAN_KIND_INTERNAL = 1;
const SPAN_STATUS_ERROR = 2;
const RUNTIME_ERROR_TYPE = {
    interrupted: "interrupted",
    nonZeroExitCode: "non_zero_exit_code",
    operationFailed: "operation_failed",
} as const;
const RUNTIME_RESULT_ATTR = {
    errorMessage: "error",
    exitCode: "exitCode",
    failed: "failed",
    interrupted: "interrupted",
    isInterrupt: "isInterrupt",
} as const;

function linksOf(attributes: Record<string, unknown>): Record<string, unknown>[] {
    const previous = attributes[AGENT_TRACER_ATTR.turnPreviousId];
    if (typeof previous !== "string" || previous.length === 0) return [];
    return [{ traceId: traceIdOf(previous), spanId: spanIdOf(previous) }];
}

function durationMsOf(attributes: Record<string, unknown>): number {
    const value = attributes[AGENT_TRACER_ATTR.durationMs];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function errorTypeOf(attributes: Record<string, unknown>): string | undefined {
    const explicit = readString(attributes, SEMCONV_ATTR.errorType);
    if (explicit !== undefined) return explicit;
    if (attributes[RUNTIME_RESULT_ATTR.interrupted] === true || attributes[RUNTIME_RESULT_ATTR.isInterrupt] === true) {
        return RUNTIME_ERROR_TYPE.interrupted;
    }
    const exitCode = attributes[RUNTIME_RESULT_ATTR.exitCode];
    if (typeof exitCode === "number" && Number.isFinite(exitCode) && exitCode !== 0) {
        return RUNTIME_ERROR_TYPE.nonZeroExitCode;
    }
    if (attributes[RUNTIME_RESULT_ATTR.failed] === true) return RUNTIME_ERROR_TYPE.operationFailed;
    return undefined;
}

function spanNameOf(record: OtlpEventRecord, attributes: Record<string, unknown>): string {
    if (record.kind === KIND.executeTool) {
        const toolName = readString(attributes, SEMCONV_ATTR.toolName);
        return toolName ? `${GEN_AI_OPERATION.executeTool} ${toolName}` : GEN_AI_OPERATION.executeTool;
    }
    if (record.kind === KIND.invokeAgent) {
        const agentName = readString(attributes, SEMCONV_ATTR.agentName);
        return agentName ? `${GEN_AI_OPERATION.invokeAgent} ${agentName}` : GEN_AI_OPERATION.invokeAgent;
    }
    return record.kind;
}

function toSpan(record: OtlpEventRecord): Record<string, unknown> {
    const attributes = baseAttributes(record);
    const errorType = errorTypeOf(attributes);
    delete attributes[RUNTIME_RESULT_ATTR.errorMessage];
    if (errorType !== undefined) attributes[SEMCONV_ATTR.errorType] = errorType;
    const endMs = record.occurredAt.getTime();
    const startMs = endMs - durationMsOf(attributes);
    const links = linksOf(attributes);
    return {
        traceId: record.traceId,
        spanId: record.spanId,
        ...(record.parentSpanId !== null ? { parentSpanId: record.parentSpanId } : {}),
        name: spanNameOf(record, attributes),
        kind: SPAN_KIND_INTERNAL,
        startTimeUnixNano: nanos(startMs),
        endTimeUnixNano: nanos(endMs),
        attributes: toKeyValues(attributes),
        ...(errorType !== undefined ? { status: { code: SPAN_STATUS_ERROR } } : {}),
        ...(links.length > 0 ? { links } : {}),
    };
}

export function buildOtlpTracesBody(records: readonly OtlpEventRecord[]): Record<string, unknown> | null {
    const spanRecords = records.filter((record) => isSpanEventKind(record.kind));
    if (spanRecords.length === 0) return null;
    const resourceSpans = [...groupByTask(spanRecords)].map(([taskId, group]) => ({
        resource: resourceOf(taskId),
        scopeSpans: [{ scope: { name: OTLP_SCOPE_NAME }, spans: group.map((record) => toSpan(record)) }],
    }));
    return { resourceSpans };
}
