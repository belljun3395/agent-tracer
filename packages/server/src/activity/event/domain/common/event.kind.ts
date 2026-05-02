import {
    EVENT_LANES,
} from "./const/event.kind.const.js";
import type { TimelineLane } from "./type/event.kind.type.js";

const TIMELINE_LANE_SET = new Set<string>(EVENT_LANES);

export function isTimelineLane(value: string | undefined): value is TimelineLane {
    return value !== undefined && TIMELINE_LANE_SET.has(value);
}
