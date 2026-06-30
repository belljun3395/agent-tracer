import { isTimelineLane } from "@monitor/timeline-api/domain/event/common/event.kind.js";
import type { TimelineLane } from "@monitor/timeline-api/domain/event/common/const/event.kind.const.js";

export function normalizeLane(raw: string): TimelineLane {
    switch (raw) {
        case "file":
            return "exploration";
        case "terminal":
        case "tool":
            return "implementation";
        case "thought":
        case "thoughts":
            return "planning";
        case "message":
            return "user";
        case "rules":
            return "implementation";
        default:
            return isTimelineLane(raw) ? raw : "user";
    }
}
