import { EVENT_RELATION_TYPES } from "./const/event.meta.const.js";
import type { EventRelationType } from "./type/event.meta.type.js";

const EVENT_RELATION_TYPE_SET = new Set<string>(EVENT_RELATION_TYPES);

export function isEventRelationType(value: string | undefined): value is EventRelationType {
    return value !== undefined && EVENT_RELATION_TYPE_SET.has(value);
}
