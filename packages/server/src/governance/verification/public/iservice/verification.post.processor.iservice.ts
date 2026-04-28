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
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: {
        readonly lane: string;
        readonly tags: readonly string[];
        readonly matches: readonly unknown[];
    };
    readonly createdAt: string;
}

export interface IVerificationPostProcessor {
    onUserMessage(event: VerificationPostProcessorEvent): Promise<void>;
    onAssistantResponse(event: VerificationPostProcessorEvent): Promise<void>;
    onOtherEvent(event: VerificationPostProcessorEvent): Promise<void>;
}
