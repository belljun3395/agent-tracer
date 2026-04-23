import type {
    MonitoringEventKind,
    MonitoringTask,
} from "~domain/index.js";

export interface RecordedEventEnvelope {
    readonly task: MonitoringTask;
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: MonitoringEventKind }[];
}
