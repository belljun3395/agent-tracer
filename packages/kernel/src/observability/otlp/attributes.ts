import { isSpanEventKind } from "~kernel/ingest/event.kind.const.js";
import { AGENT_TRACER_ATTR, GEN_AI_PROVIDER, SEMCONV_ATTR } from "../semconv.const.js";
import type { OtlpEventRecord, OtlpKeyValue } from "./model.js";

function anyValue(value: unknown): Record<string, unknown> | null {
    if (typeof value === "string") return { stringValue: value };
    if (typeof value === "boolean") return { boolValue: value };
    if (typeof value === "number" && Number.isFinite(value)) {
        return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
    }
    if (Array.isArray(value)) {
        const values = value.map((item) => anyValue(item)).filter((item): item is Record<string, unknown> => item !== null);
        return { arrayValue: { values } };
    }
    if (value === null || value === undefined) return null;
    return { stringValue: JSON.stringify(value) };
}

function attributeKeyOf(key: string): string {
    return key.includes(".") ? key : `agent_tracer.${key}`;
}

const JSON_SERIALIZED_ATTRIBUTES = new Set<string>([
    SEMCONV_ATTR.inputMessages,
    SEMCONV_ATTR.outputMessages,
    SEMCONV_ATTR.systemInstructions,
]);

export function toKeyValues(attributes: Readonly<Record<string, unknown>>): OtlpKeyValue[] {
    const out: OtlpKeyValue[] = [];
    for (const [key, raw] of Object.entries(attributes)) {
        const value = JSON_SERIALIZED_ATTRIBUTES.has(key) ? { stringValue: JSON.stringify(raw) } : anyValue(raw);
        if (value !== null) out.push({ key: attributeKeyOf(key), value });
    }
    return out;
}

export function readRecord(payload: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = payload[key];
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

export function readString(payload: Record<string, unknown>, key: string): string | undefined {
    const value = payload[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function baseAttributes(record: OtlpEventRecord): Record<string, unknown> {
    const attributes: Record<string, unknown> = { ...readRecord(record.payload, "metadata") };
    const runtimeSource = readString(record.payload, "runtimeSource")
        ?? readString(attributes, AGENT_TRACER_ATTR.runtimeSource);
    if (runtimeSource !== undefined) {
        attributes[AGENT_TRACER_ATTR.runtimeSource] = runtimeSource;
        attributes[SEMCONV_ATTR.providerName] = GEN_AI_PROVIDER.anthropic;
    }
    const lane = readString(record.payload, "lane");
    if (lane !== undefined) attributes[AGENT_TRACER_ATTR.lane] = lane;
    if (record.sessionId !== null) attributes[SEMCONV_ATTR.conversationId] = record.sessionId;
    if (isSpanEventKind(record.kind)) attributes[SEMCONV_ATTR.operationName] = record.kind;
    if (attributes[AGENT_TRACER_ATTR.mcpServer] !== undefined && attributes[SEMCONV_ATTR.mcpToolName] !== undefined) {
        attributes[SEMCONV_ATTR.mcpMethodName] = "tools/call";
    }
    return attributes;
}
