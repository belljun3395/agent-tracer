import type { EventId, RuntimeSource, TaskId } from "../monitoring/ids.js";
import type { MonitoringTask, TimelineEvent } from "../monitoring/types.js";
export type OpenInferenceSpanKind = "AGENT" | "CHAIN" | "TOOL" | "LLM" | "RETRIEVER" | "UNKNOWN";
export interface OpenInferenceSpanRecord {
    readonly spanId: EventId;
    readonly parentSpanId?: EventId;
    readonly name: string;
    readonly kind: OpenInferenceSpanKind;
    readonly startTime: string;
    readonly attributes: Record<string, unknown>;
}
export interface OpenInferenceTaskExport {
    readonly taskId: TaskId;
    readonly runtimeSource?: RuntimeSource;
    readonly spans: readonly OpenInferenceSpanRecord[];
}
/**
 * Converts a task timeline into an OpenInference-shaped export payload.
 */
export declare function buildOpenInferenceTaskExport(task: MonitoringTask, timeline: readonly TimelineEvent[]): OpenInferenceTaskExport;
/**
 * Maps a single timeline event to an OpenInference span with monitor-specific attributes.
 */
export declare function buildOpenInferenceSpanRecord(runtimeSource: RuntimeSource | undefined, event: TimelineEvent): OpenInferenceSpanRecord;
//# sourceMappingURL=openinference.d.ts.map