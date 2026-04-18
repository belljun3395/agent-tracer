import type { MonitoringEventKind, TimelineLane } from "@monitor/domain";

/**
 * Pins lifecycle and user-facing event kinds to non-overridable canonical lanes.
 */
export function getCanonicalLane(kind: MonitoringEventKind): TimelineLane | undefined {
    if (kind === "user.message" || kind === "task.start" || kind === "task.complete" || kind === "task.error") {
        return "user";
    }
    return undefined;
}
