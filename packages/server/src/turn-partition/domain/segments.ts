import { isUserMessageEvent } from "~event/public/predicates.js";
import type { TimelineEvent } from "~event/public/types/event.types.js";
import type { TurnSegment } from "./turn.segment.model.js";

const REQUEST_PREVIEW_LIMIT = 120;

/**
 * Groups events into conversation turns using user.message as the boundary.
 *
 * Rules:
 * - Each user.message starts a new turn (turnIndex = 1, 2, 3, …).
 * - Events preceding the first user.message collapse into a prelude segment
 *   with turnIndex = 0 and isPrelude = true.
 * - If no user.message exists, all events form a single prelude segment with
 *   turnIndex = 1 (to keep numbering stable for single-turn callers).
 */
export function segmentEventsByTurn(events: readonly TimelineEvent[]): readonly TurnSegment[] {
    if (events.length === 0) {
        return [];
    }

    const boundaryIndices = events
        .map((event, index) => (isUserMessageEvent(event) ? index : -1))
        .filter((index) => index >= 0);

    if (boundaryIndices.length === 0) {
        const bucket = [...events];
        return [
            {
                turnIndex: 1,
                isPrelude: true,
                startAt: bucket[0]!.createdAt,
                endAt: bucket[bucket.length - 1]!.createdAt,
                requestPreview: null,
                events: bucket,
            },
        ];
    }

    const segments: TurnSegment[] = [];
    const firstBoundary = boundaryIndices[0]!;

    if (firstBoundary > 0) {
        const preludeEvents = events.slice(0, firstBoundary);
        segments.push({
            turnIndex: 0,
            isPrelude: true,
            startAt: preludeEvents[0]!.createdAt,
            endAt: events[firstBoundary]!.createdAt,
            requestPreview: null,
            events: preludeEvents,
        });
    }

    for (let i = 0; i < boundaryIndices.length; i += 1) {
        const start = boundaryIndices[i]!;
        const end = boundaryIndices[i + 1] ?? events.length;
        const turnEvents = events.slice(start, end);
        const userMessage = turnEvents[0]!;
        const endAt = end < events.length
            ? events[end]!.createdAt
            : turnEvents[turnEvents.length - 1]!.createdAt;
        segments.push({
            turnIndex: i + 1,
            isPrelude: false,
            startAt: userMessage.createdAt,
            endAt,
            requestPreview: renderRequestPreview(userMessage),
            events: turnEvents,
        });
    }

    return segments;
}

function renderRequestPreview(event: TimelineEvent): string | null {
    const source = event.body ?? event.title;
    const normalized = source.replace(/\s+/g, " ").trim();
    if (!normalized) {
        return null;
    }
    if (normalized.length <= REQUEST_PREVIEW_LIMIT) {
        return normalized;
    }
    return `${normalized.slice(0, REQUEST_PREVIEW_LIMIT - 1).trimEnd()}…`;
}

/**
 * Returns the subset of events that belong to the selected turn range.
 * The range is inclusive on both ends and expressed as turnIndex values
 * produced by segmentEventsByTurn. Pass null for either bound to leave it open.
 */
export function filterEventsByTurnRange(
    events: readonly TimelineEvent[],
    range: { readonly from: number | null; readonly to: number | null },
): readonly TimelineEvent[] {
    if (range.from === null && range.to === null) {
        return events;
    }
    const segments = segmentEventsByTurn(events);
    if (segments.length === 0) {
        return events;
    }
    const from = range.from ?? segments[0]!.turnIndex;
    const to = range.to ?? segments[segments.length - 1]!.turnIndex;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const collected: TimelineEvent[] = [];
    for (const segment of segments) {
        if (segment.turnIndex >= lo && segment.turnIndex <= hi) {
            collected.push(...segment.events);
        }
    }
    return collected;
}
