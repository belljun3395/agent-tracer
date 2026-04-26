import type { TimelineEventRecord } from "~domain/monitoring.js";

export function shouldResetTimelineFollowForTaskChange(input: {
    previousTaskId: string | null | undefined;
    nextTaskId: string | null | undefined;
    selectedEventId: string | null;
    timeline: readonly TimelineEventRecord[];
}): boolean {
    if (!input.nextTaskId || input.previousTaskId === input.nextTaskId) {
        return false;
    }
    if (!input.selectedEventId) {
        return true;
    }
    return !input.timeline.some((event) => event.id === input.selectedEventId);
}

export function computeTimelineFollowScrollLeft(input: {
    clientWidth: number;
    scrollWidth: number;
    timelineFocusRight: number;
}): number {
    const rightPadding = Math.max(72, Math.round(input.clientWidth * 0.08));
    const maxScrollLeft = Math.max(0, input.scrollWidth - input.clientWidth);
    return Math.max(0, Math.min(maxScrollLeft, input.timelineFocusRight - input.clientWidth + rightPadding));
}
