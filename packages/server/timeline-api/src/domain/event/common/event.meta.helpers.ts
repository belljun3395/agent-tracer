import { EVENT_RELATION_TYPES } from "@monitor/timeline-api/domain/event/common/const/event.meta.const.js";
import type { EventRelationType } from "@monitor/timeline-api/domain/event/common/const/event.meta.const.js";

const EVENT_RELATION_TYPE_SET = new Set<string>(EVENT_RELATION_TYPES);

export function isEventRelationType(value: string | undefined): value is EventRelationType {
    return value !== undefined && EVENT_RELATION_TYPE_SET.has(value);
}
