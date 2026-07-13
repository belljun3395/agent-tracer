import { Inject, Injectable } from "@nestjs/common";
import { EventPresentation, type TimelineItemDto } from "@monitor/tracer-domain";
import { TIMELINE_EVENT_READER, type TimelineEventReaderPort } from "~tracer-api/domain/timeline/port/event.reader.port.js";
import { TIMELINE_TASK_READER, type TimelineTaskReaderPort } from "~tracer-api/domain/timeline/port/task.reader.port.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export interface GetTimelineInput {
    readonly userId: string;
    readonly taskId: string;
    /** 생략하면 최신 윈도우를 반환하는, 과거 페이지 조회용 seq 커서다. */
    readonly cursor?: string;
    readonly limit?: number;
}

export interface GetTimelineResult {
    readonly items: readonly TimelineItemDto[];
    /** 더 이전 이벤트가 없으면 null인 다음 페이지 커서다. */
    readonly nextCursor: string | null;
}

@Injectable()
export class GetTimelineUseCase {
    constructor(
        @Inject(TIMELINE_TASK_READER)
        private readonly tasks: TimelineTaskReaderPort,
        @Inject(TIMELINE_EVENT_READER)
        private readonly events: TimelineEventReaderPort,
    ) {}

    async execute(input: GetTimelineInput): Promise<GetTimelineResult | null> {
        const task = await this.tasks.findById(input.taskId);
        // 남의 작업은 존재 여부도 드러내지 않는다.
        if (task === null || !task.isOwnedBy(input.userId)) return null;
        const limit = clampLimit(input.limit);
        const page = await this.events.findTimelineWindow(input.taskId, input.cursor, limit);
        const items = [...page].reverse().map((event) => new EventPresentation(event).toTimelineItem());
        const oldestInPage = page.at(-1);
        const nextCursor = page.length === limit && oldestInPage !== undefined ? oldestInPage.seq : null;
        return { items, nextCursor };
    }
}

function clampLimit(raw: number | undefined): number {
    if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
    return Math.min(Math.floor(raw), MAX_LIMIT);
}
