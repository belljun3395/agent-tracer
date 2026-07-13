import { AGENT_TRACER_ATTR } from "../semconv.const.js";
import { OTLP_SERVICE_NAME, type OtlpEventRecord } from "./model.js";

export const OTLP_SCOPE_NAME = "agent-tracer.ingest";

export function nanos(millis: number): string {
    return `${BigInt(Math.round(millis)) * 1_000_000n}`;
}

export function resourceOf(taskId: string): Record<string, unknown> {
    return {
        attributes: [
            { key: "service.name", value: { stringValue: OTLP_SERVICE_NAME } },
            { key: AGENT_TRACER_ATTR.taskId, value: { stringValue: taskId } },
        ],
    };
}

export function groupByTask(records: readonly OtlpEventRecord[]): Map<string, OtlpEventRecord[]> {
    const groups = new Map<string, OtlpEventRecord[]>();
    for (const record of records) {
        const bucket = groups.get(record.taskId);
        if (bucket) bucket.push(record);
        else groups.set(record.taskId, [record]);
    }
    return groups;
}
