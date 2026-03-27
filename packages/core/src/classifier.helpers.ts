import type { MonitoringEventKind, TimelineLane } from "./domain/types.js";

export function getCanonicalLane(kind: MonitoringEventKind): TimelineLane | undefined {
  if (kind === "user.message" || kind === "task.start" || kind === "task.complete" || kind === "task.error") {
    return "user";
  }

  return undefined;
}
