import { EVENT_SUBTYPE_GROUPS, EVENT_TOOL_FAMILIES } from "./const/event.subtype.keys.const.js";
import type { EventSubtypeGroup, EventToolFamily } from "./type/event.subtype.keys.type.js";

const EVENT_SUBTYPE_GROUP_SET = new Set<string>(EVENT_SUBTYPE_GROUPS);
const EVENT_TOOL_FAMILY_SET = new Set<string>(EVENT_TOOL_FAMILIES);
/**
 * Guards that `value` is a registered EventSubtypeGroup.
 * Accepts null and undefined — both produce false, so callers can pass optional
 * metadata fields directly without a preceding null check.
 * When this returns true, TypeScript narrows the type to EventSubtypeGroup.
 */
export function isKnownEventSubtypeGroup(value: string | null | undefined): value is EventSubtypeGroup {
    return value != null && EVENT_SUBTYPE_GROUP_SET.has(value);
}

/**
 * Guards that `value` is a registered EventToolFamily.
 * Accepts null and undefined — both produce false, so callers can pass optional
 * metadata fields directly without a preceding null check.
 * When this returns true, TypeScript narrows the type to EventToolFamily.
 */
export function isKnownEventToolFamily(value: string | null | undefined): value is EventToolFamily {
    return value != null && EVENT_TOOL_FAMILY_SET.has(value);
}
