import type { MonitoringEventKind, TimelineLane } from "@monitor/activity/event/domain/common/const/event.kind.const.js";
import type { EventClassificationMatch } from "@monitor/activity/event/domain/model/timeline.event.model.js";

/**
 * Outbound port — verification module hooks into event logging to evaluate
 * rules and update turn lifecycle. Adapter wraps the legacy verification
 * post-processor services until verification migrates into a feature module.
 */

export interface PostProcessableEvent {
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
    /** Called after a user.message event is logged. Opens the turn first, then evaluates rules. */
    onUserMessage(event: PostProcessableEvent): Promise<void>;
    /** Called after an assistant.response event. Evaluates rules first, then closes turn. */
    onAssistantResponse(event: PostProcessableEvent): Promise<void>;
    /** Default order for all other event kinds: rules first, turn lifecycle second. */
    onOtherEvent(event: PostProcessableEvent): Promise<void>;
}
