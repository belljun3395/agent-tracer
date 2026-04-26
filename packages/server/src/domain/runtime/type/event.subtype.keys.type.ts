import type {
    EVENT_SUBTYPE_GROUPS,
    EVENT_SUBTYPE_KEYS,
    EVENT_TOOL_FAMILIES,
} from "../const/event.subtype.keys.const.js";

export type EventSubtypeKey = typeof EVENT_SUBTYPE_KEYS[number];
export type EventSubtypeGroup = (typeof EVENT_SUBTYPE_GROUPS)[number];
export type EventToolFamily = (typeof EVENT_TOOL_FAMILIES)[number];
