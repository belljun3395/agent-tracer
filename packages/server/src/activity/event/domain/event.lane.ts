import { isTimelineLane } from "./common/event.kind.js";
import type { TimelineLane } from "./common/type/event.kind.type.js";

/**
 * Normalize an arbitrary lane string (incoming from ingest sources or stored
 * rows) into the canonical TimelineLane. Falls back to "user" when no mapping
 * applies.
 */
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
