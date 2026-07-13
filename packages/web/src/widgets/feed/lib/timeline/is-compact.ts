import { KIND } from "@monitor/kernel";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";

/** context-saved kind는 runtime에서 여러 용도로 겹쳐 쓰인다. */
export function isContextCompactEvent(event: TimelineEventRecord): boolean {
  if (event.kind !== KIND.contextSaved) return false;
  const phase = event.metadata["compactPhase"];
  return phase === "before" || phase === "after";
}
