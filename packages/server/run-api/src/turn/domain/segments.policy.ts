import { isUserMessageEvent } from "@monitor/timeline-api/event/public/predicates.js";
import type { TimelineEvent } from "@monitor/timeline-api/event/public/types/event.types.js";
import type { TurnSegment } from "./type/turn.segment.type.js";

const REQUEST_PREVIEW_LIMIT = 120;

export function segmentEventsByTurn(events: readonly TimelineEvent[]): readonly TurnSegment[] {
    if (events.length === 0) {
        // 이벤트가 없으면 턴도 만들지 않는다.
        return [];
    }

    const boundaryIndices = events
        .map((event, index) => (isUserMessageEvent(event) ? index : -1))
        .filter((index) => index >= 0);

    if (boundaryIndices.length === 0) {
        // 사용자 메시지가 없으면 전체 이벤트를 prelude로 묶어 실제 턴에서 제외한다.
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
        // 첫 사용자 요청 전 이벤트는 대화 턴이 아니라 prelude로 분리한다.
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
        // 표시할 요청 텍스트가 없으면 미리보기를 비워 둔다.
        return null;
    }
    if (normalized.length <= REQUEST_PREVIEW_LIMIT) {
        // 짧은 요청은 잘라내지 않고 그대로 표시한다.
        return normalized;
    }
    return `${normalized.slice(0, REQUEST_PREVIEW_LIMIT - 1).trimEnd()}…`;
}
