/**
 * Public iservice — append a generic domain event to the event-sourcing log.
 * Other modules (e.g. turn-partition) call this to record their domain events
 * into the centralized events table owned by the event module.
 */

export interface DomainEventAppendInput {
    readonly eventTime: number;
    readonly eventType: string;
    readonly schemaVer: number;
    readonly aggregateId: string;
    readonly sessionId?: string | null;
    readonly actor: "user" | "system" | "claude" | "codex";
    readonly correlationId?: string | null;
    readonly causationId?: string | null;
    readonly payload: Record<string, unknown>;
}

export interface IDomainEventAppender {
    append(input: DomainEventAppendInput): void;
}
