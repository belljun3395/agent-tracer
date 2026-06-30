import type { EventSubtypeGroup, EventSubtypeKey, EventToolFamily } from "@monitor/timeline-api/domain/event/runtime/const/event.subtype.keys.const.js";

export const SERVER_SUBTYPE_KEYS = ["handoff", "bookmark", "uncategorized"] as const;

export interface SubtypeRegistryEntry {
    readonly label: string;
    readonly group: EventSubtypeGroup;
    readonly toolFamily: EventToolFamily;
    readonly operation: string;
}

export type ServerSubtypeKey = (typeof SERVER_SUBTYPE_KEYS)[number];
export type AllEventSubtypeKey = EventSubtypeKey | ServerSubtypeKey;
