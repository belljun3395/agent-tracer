export type EventId = string;
export type EventActor = "user" | "claude" | "codex" | "system";

export interface TimeRange {
    readonly from?: number;
    readonly to?: number;
}

export interface DomainEventBase<TType extends string, TPayload extends Record<string, unknown>> {
    readonly eventId: EventId;
    readonly eventTime: number;
    readonly eventType: TType;
    readonly schemaVer: number;
    readonly aggregateId: string;
    readonly sessionId?: string;
    readonly actor: EventActor;
    readonly correlationId?: string;
    readonly causationId?: string;
    readonly payload: TPayload;
    readonly recordedAt: number;
}

export type DomainEventDraft<TType extends string = string, TPayload extends Record<string, unknown> = Record<string, unknown>> =
    Omit<DomainEventBase<TType, TPayload>, "eventId" | "recordedAt"> & {
        readonly eventId?: EventId;
        readonly recordedAt?: number;
    };
