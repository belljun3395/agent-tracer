import type { MonitoringEventKind, TimelineLane } from "@monitor/activity-api/event/domain/common/const/event.kind.const.js";
import type { EventClassificationMatch } from "@monitor/activity-api/event/domain/model/timeline.event.model.js";

/**
 * Public iservice — verification post-processing of timeline events as they
 * are logged. Consumed by the event module's verification post processor
 * adapter, which fans out to RuleEnforcementPostProcessor and
 * TurnLifecyclePostProcessor.
 *
 * The shapes are kept structural so callers don't depend on internal types.
 */

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

export interface IVerificationPostProcessor {
    onUserMessage(event: VerificationPostProcessorEvent): Promise<void>;
    onAssistantResponse(event: VerificationPostProcessorEvent): Promise<void>;
    onOtherEvent(event: VerificationPostProcessorEvent): Promise<void>;
}
