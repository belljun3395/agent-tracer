/**
 * Outbound port — verification module hooks into event logging to evaluate
 * rules and update turn lifecycle. Adapter wraps the legacy verification
 * post-processor services until verification migrates into a feature module.
 */

export interface PostProcessableEvent {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: { readonly lane: string; readonly tags: readonly string[]; readonly matches: readonly unknown[] };
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
