import {
    EVENT_LANES,
} from "@monitor/timeline-api/domain/event/common/const/event.kind.const.js";
import type { TimelineLane } from "@monitor/timeline-api/domain/event/common/const/event.kind.const.js";

const TIMELINE_LANE_SET = new Set<string>(EVENT_LANES);

export function isTimelineLane(value: string | undefined): value is TimelineLane {
    return value !== undefined && TIMELINE_LANE_SET.has(value);
}
