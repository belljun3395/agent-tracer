import type { DomainEventBase, DomainEventDraft, EventActor, EventId, EventTypeDefinition, TimeRange } from "./event.type.js";
import { TASK_EVENT_DEFINITIONS, type TaskEventType } from "./task.events.js";
import { SESSION_EVENT_DEFINITIONS, type SessionEventType } from "./session.events.js";
import { RUNTIME_EVENT_DEFINITIONS, type RuntimeEventType } from "./runtime.events.js";
import { CURATION_EVENT_DEFINITIONS, type CurationEventType } from "./curation.events.js";
import { WORKFLOW_EVENT_DEFINITIONS, type WorkflowEventType } from "./workflow.events.js";
import { SYSTEM_EVENT_DEFINITIONS, type SystemEventType } from "./system.events.js";

export type DomainEventType =
    | TaskEventType
    | SessionEventType
    | RuntimeEventType
    | CurationEventType
    | WorkflowEventType
    | SystemEventType;

export type DomainEvent = DomainEventBase<DomainEventType, Record<string, unknown>>;
export type AnyDomainEventDraft = DomainEventDraft<DomainEventType, Record<string, unknown>>;

export const DOMAIN_EVENT_DEFINITIONS = [
    ...TASK_EVENT_DEFINITIONS,
    ...SESSION_EVENT_DEFINITIONS,
    ...RUNTIME_EVENT_DEFINITIONS,
    ...CURATION_EVENT_DEFINITIONS,
    ...WORKFLOW_EVENT_DEFINITIONS,
    ...SYSTEM_EVENT_DEFINITIONS,
] as readonly EventTypeDefinition<DomainEventType>[];

const DEFINITIONS_BY_TYPE = new Map<DomainEventType, EventTypeDefinition<DomainEventType>>(
    DOMAIN_EVENT_DEFINITIONS.map((definition) => [definition.eventType, definition]),
);

export function getDomainEventDefinition(eventType: DomainEventType): EventTypeDefinition<DomainEventType> {
    const definition = DEFINITIONS_BY_TYPE.get(eventType);
    if (!definition) {
        throw new Error(`Unsupported domain event type: ${eventType}`);
    }
    return definition;
}

export function validateDomainEventDraft(event: AnyDomainEventDraft): void {
    if (!Number.isFinite(event.eventTime)) {
        throw new Error("Domain event requires finite eventTime");
    }
    if (event.aggregateId.trim() === "") {
        throw new Error("Domain event requires aggregateId");
    }
    if (event.schemaVer !== getDomainEventDefinition(event.eventType).schemaVer) {
        throw new Error(`Unsupported schema version ${event.schemaVer} for ${event.eventType}`);
    }
    getDomainEventDefinition(event.eventType).validate(event.payload);
}

export type {
    DomainEventBase,
    DomainEventDraft,
    EventActor,
    EventId,
    EventTypeDefinition,
    TimeRange,
};
export * from "./event.type.js";
export * from "./task.events.js";
export * from "./session.events.js";
export * from "./runtime.events.js";
export * from "./curation.events.js";
export * from "./workflow.events.js";
export * from "./system.events.js";
