import type { EventTypeDefinition } from "./definition/event.definition.js";
import { CURATION_EVENT_DEFINITIONS } from "./curation.events.js";
import { RUNTIME_EVENT_DEFINITIONS } from "./runtime.events.js";
import { SESSION_EVENT_DEFINITIONS } from "./session.events.js";
import { SYSTEM_EVENT_DEFINITIONS } from "./system.events.js";
import { TASK_EVENT_DEFINITIONS } from "./task.events.js";
import { WORKFLOW_EVENT_DEFINITIONS } from "./workflow.events.js";
import type { AnyDomainEventDraft, DomainEventType } from "./model/domain.events.model.js";

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
