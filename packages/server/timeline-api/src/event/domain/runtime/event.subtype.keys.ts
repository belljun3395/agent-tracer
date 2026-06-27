

import { EVENT_SUBTYPE_GROUPS, EVENT_TOOL_FAMILIES } from "./const/event.subtype.keys.const.js";
import type { EventSubtypeGroup, EventToolFamily } from "./const/event.subtype.keys.const.js";

const EVENT_SUBTYPE_GROUP_SET = new Set<string>(EVENT_SUBTYPE_GROUPS);
const EVENT_TOOL_FAMILY_SET = new Set<string>(EVENT_TOOL_FAMILIES);

export function isKnownEventSubtypeGroup(value: string | null | undefined): value is EventSubtypeGroup {
    return value != null && EVENT_SUBTYPE_GROUP_SET.has(value);
}

export function isKnownEventToolFamily(value: string | null | undefined): value is EventToolFamily {
    return value != null && EVENT_TOOL_FAMILY_SET.has(value);
}
