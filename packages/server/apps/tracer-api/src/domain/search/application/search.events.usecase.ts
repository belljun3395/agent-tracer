import { Inject, Injectable } from "@nestjs/common";
import { EVENT_SEARCH, type EventSearchHit, type EventSearchPort } from "~tracer-api/domain/search/port/event.search.port.js";
import { MEMO_SEARCH, type MemoSearchHit, type MemoSearchPort } from "~tracer-api/domain/search/port/memo.search.port.js";
import { clampSearchLimit } from "~tracer-api/support/search.limit.js";

export interface SearchEventsInput {
    readonly userId: string;
    readonly q?: string;
    readonly taskId?: string;
    readonly kind?: string;
    readonly lane?: string;
    readonly from?: string;
    readonly to?: string;
    readonly limit?: number;
}

@Injectable()
export class SearchEventsUseCase {
    constructor(
        @Inject(EVENT_SEARCH) private readonly search: EventSearchPort,
        @Inject(MEMO_SEARCH) private readonly memoSearch: MemoSearchPort,
    ) {}

    async execute(input: SearchEventsInput): Promise<{ readonly items: readonly (EventSearchHit | MemoSearchHit)[] }> {
        const limit = clampSearchLimit(input.limit);
        const [events, memos] = await Promise.all([
            this.search.search({
                userId: input.userId,
                limit,
                ...(input.q !== undefined ? { q: input.q } : {}),
                ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
                ...(input.kind !== undefined ? { kind: input.kind } : {}),
                ...(input.lane !== undefined ? { lane: input.lane } : {}),
                ...(input.from !== undefined ? { from: input.from } : {}),
                ...(input.to !== undefined ? { to: input.to } : {}),
            }),
            this.memoSearch.search({
                userId: input.userId,
                limit,
                hasEvent: true,
                ...(input.q !== undefined ? { q: input.q } : {}),
                ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
            }),
        ]);
        return { items: [...events, ...memos] };
    }
}
