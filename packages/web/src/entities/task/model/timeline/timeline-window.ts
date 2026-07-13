import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";

export const TIMELINE_WINDOW_CAP = 600;

function dedupeById(
  existing: readonly TimelineEventRecord[],
  incoming: readonly TimelineEventRecord[],
): readonly TimelineEventRecord[] {
  const existingIds = new Set(existing.map((event) => event.id));
  return incoming.filter((event) => !existingIds.has(event.id));
}

export function appendToTimelineWindow(
  window: readonly TimelineEventRecord[],
  event: TimelineEventRecord,
  cap: number = TIMELINE_WINDOW_CAP,
): readonly TimelineEventRecord[] {
  if (window.some((existing) => existing.id === event.id)) return window;
  const next = [...window, event];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

export function prependPageToTimelineWindow(
  window: readonly TimelineEventRecord[],
  page: readonly TimelineEventRecord[],
  cap: number = TIMELINE_WINDOW_CAP,
): readonly TimelineEventRecord[] {
  const deduped = dedupeById(window, page);
  const next = [...deduped, ...window];
  return next.length > cap ? next.slice(0, cap) : next;
}
