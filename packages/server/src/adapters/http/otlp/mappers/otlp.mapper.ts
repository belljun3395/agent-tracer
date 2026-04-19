import type { OtlpKeyValue, OtlpLogsRequest } from "../schemas/otlp.logs.schema.js";
import {
    OTLP_EVENT_NAMES,
    OTLP_FALLBACK_RUNTIME_SOURCE,
    OTLP_LOG_ATTRS,
    OTLP_RESOURCE_ATTRS,
} from "~domain/index.js";

export interface OtlpApiRequestRecord {
    readonly sessionId: string;
    readonly runtimeSource: string;
    readonly apiCalledAt?: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreateTokens: number;
    readonly costUsd?: number;
    readonly durationMs?: number;
    readonly model?: string;
    readonly promptId?: string;
}

function readAttr(attrs: OtlpKeyValue[], key: string): string | number | boolean | undefined {
    const found = attrs.find(a => a.key === key);
    if (!found) return undefined;
    const v: unknown = found.value;
    if (typeof v !== "object" || v === null) return undefined;
    if ("stringValue" in v && typeof (v as { stringValue: unknown }).stringValue === "string") {
        return (v as { stringValue: string }).stringValue;
    }
    if ("intValue" in v) {
        const iv = (v as { intValue: unknown }).intValue;
        if (typeof iv === "string") return parseInt(iv, 10);
        if (typeof iv === "number") return iv;
    }
    if ("doubleValue" in v && typeof (v as { doubleValue: unknown }).doubleValue === "number") {
        return (v as { doubleValue: number }).doubleValue;
    }
    if ("boolValue" in v && typeof (v as { boolValue: unknown }).boolValue === "boolean") {
        return (v as { boolValue: boolean }).boolValue;
    }
    return undefined;
}

function toNumber(v: string | number | boolean | undefined): number | undefined {
    if (typeof v === "number") return v;
    if (typeof v === "string") { const n = Number(v); return isNaN(n) ? undefined : n; }
    return undefined;
}

function toString(v: string | number | boolean | undefined): string | undefined {
    return typeof v === "string" ? v : undefined;
}

export function extractApiRequestRecords(req: OtlpLogsRequest): OtlpApiRequestRecord[] {
    const records: OtlpApiRequestRecord[] = [];

    for (const resourceLog of req.resourceLogs) {
        const resourceAttrs = resourceLog.resource?.attributes ?? [];
        const resourceSessionId = toString(readAttr(resourceAttrs, OTLP_RESOURCE_ATTRS.sessionId));
        const resourceRuntimeSource = toString(readAttr(resourceAttrs, OTLP_RESOURCE_ATTRS.runtimeSource)) ?? OTLP_FALLBACK_RUNTIME_SOURCE;

        for (const scopeLog of resourceLog.scopeLogs) {
            for (const logRecord of scopeLog.logRecords) {
                const attrs = logRecord.attributes;
                const eventName = toString(readAttr(attrs, OTLP_LOG_ATTRS.eventName));
                if (eventName !== OTLP_EVENT_NAMES.apiRequest) continue;

                const sessionId = toString(readAttr(attrs, OTLP_LOG_ATTRS.sessionId)) ?? resourceSessionId;
                if (!sessionId) continue;

                const timeNano = logRecord.timeUnixNano;
                const apiCalledAt = timeNano
                    ? new Date(parseInt(timeNano, 10) / 1_000_000).toISOString()
                    : undefined;

                const inputTokens = toNumber(readAttr(attrs, OTLP_LOG_ATTRS.inputTokens)) ?? 0;
                const outputTokens = toNumber(readAttr(attrs, OTLP_LOG_ATTRS.outputTokens)) ?? 0;
                const cacheReadTokens = toNumber(readAttr(attrs, OTLP_LOG_ATTRS.cacheReadTokens)) ?? 0;
                const cacheCreateTokens = toNumber(readAttr(attrs, OTLP_LOG_ATTRS.cacheCreateTokens)) ?? 0;
                const costUsd = toNumber(readAttr(attrs, OTLP_LOG_ATTRS.costUsd));
                const durationMs = toNumber(readAttr(attrs, OTLP_LOG_ATTRS.durationMs));
                const model = toString(readAttr(attrs, OTLP_LOG_ATTRS.model));
                const promptId = toString(readAttr(attrs, OTLP_LOG_ATTRS.promptId));

                records.push({
                    sessionId,
                    runtimeSource: resourceRuntimeSource,
                    ...(apiCalledAt ? { apiCalledAt } : {}),
                    inputTokens,
                    outputTokens,
                    cacheReadTokens,
                    cacheCreateTokens,
                    ...(costUsd != null ? { costUsd } : {}),
                    ...(durationMs != null ? { durationMs } : {}),
                    ...(model ? { model } : {}),
                    ...(promptId ? { promptId } : {}),
                });
            }
        }
    }

    return records;
}
