import {
    EVENT_LANES,
    TODO_STATES,
} from "./const/event.kind.const.js";
import type { TimelineLane, TodoState } from "./type/event.kind.type.js";

const TIMELINE_LANE_SET = new Set<string>(EVENT_LANES);
const TODO_STATE_SET = new Set<string>(TODO_STATES);

export function isTimelineLane(value: string | undefined): value is TimelineLane {
    return value !== undefined && TIMELINE_LANE_SET.has(value);
}

export function isTodoState(value: string | undefined): value is TodoState {
    return value !== undefined && TODO_STATE_SET.has(value);
}
