import type { EventTypeDefinition } from "./definition/event.definition.js";

/**
 * System events are reserved for cross-cutting infrastructure events
 * (e.g. verification rule lifecycle in Phase 2). Currently empty.
 */
export const SYSTEM_EVENT_DEFINITIONS: ReadonlyArray<EventTypeDefinition<string>> = [];

export type SystemEventType = string;
