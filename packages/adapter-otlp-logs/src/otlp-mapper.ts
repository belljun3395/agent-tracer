import type { OtlpKeyValue, OtlpLogsRequest } from "./schemas.otlp.js";

export interface OtlpApiRequestRecord {
    readonly sessionId: string;
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
        const resourceSessionId = toString(readAttr(resourceAttrs, "session.id"));

        for (const scopeLog of resourceLog.scopeLogs) {
            for (const logRecord of scopeLog.logRecords) {
                const attrs = logRecord.attributes;
                const eventName = toString(readAttr(attrs, "event.name"));
                if (eventName !== "api_request") continue;

                const sessionId = toString(readAttr(attrs, "session.id")) ?? resourceSessionId;
                if (!sessionId) continue;

                const inputTokens = toNumber(readAttr(attrs, "input_tokens")) ?? 0;
                const outputTokens = toNumber(readAttr(attrs, "output_tokens")) ?? 0;
                const cacheReadTokens = toNumber(readAttr(attrs, "cache_read_tokens")) ?? 0;
                const cacheCreateTokens = toNumber(readAttr(attrs, "cache_creation_tokens")) ?? 0;
                const costUsd = toNumber(readAttr(attrs, "cost_usd"));
                const durationMs = toNumber(readAttr(attrs, "duration_ms"));
                const model = toString(readAttr(attrs, "model"));
                const promptId = toString(readAttr(attrs, "prompt.id"));

                records.push({
                    sessionId,
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
