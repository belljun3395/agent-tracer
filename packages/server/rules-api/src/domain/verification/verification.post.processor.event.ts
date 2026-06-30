import type { MonitoringEventKind, TimelineLane, EventClassificationMatch } from "@monitor/timeline-api/public/event/types/event.types.js";

export interface VerificationPostProcessorEvent {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: {
        readonly lane: TimelineLane;
        readonly tags: readonly string[];
        readonly matches: readonly EventClassificationMatch[];
    };
    readonly createdAt: string;
}
