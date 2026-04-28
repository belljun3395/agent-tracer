import type { EventSubtypeGroup, EventSubtypeKey, EventToolFamily } from "~activity/event/domain/runtime/type/event.subtype.keys.type.js";
import type { SERVER_SUBTYPE_KEYS } from "../const/subtype.registry.const.js";

export interface SubtypeRegistryEntry {
    readonly label: string;
    readonly group: EventSubtypeGroup;
    readonly toolFamily: EventToolFamily;
    readonly operation: string;
}

export type ServerSubtypeKey = (typeof SERVER_SUBTYPE_KEYS)[number];

export type AllEventSubtypeKey = EventSubtypeKey | ServerSubtypeKey;
