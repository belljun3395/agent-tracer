import { Inject, Injectable } from "@nestjs/common";
import { clampSearchLimit } from "~tracer-api/support/search.limit.js";
import { TASK_SEARCH, type TaskSearchHit, type TaskSearchPort } from "~tracer-api/domain/search/port/task.search.port.js";
import { MEMO_SEARCH, type MemoSearchHit, type MemoSearchPort } from "~tracer-api/domain/search/port/memo.search.port.js";

export interface SearchTasksInput {
    readonly userId: string;
    readonly q: string;
    readonly limit?: number;
}

@Injectable()
export class SearchTasksUseCase {
    constructor(
        @Inject(TASK_SEARCH) private readonly search: TaskSearchPort,
        @Inject(MEMO_SEARCH) private readonly memoSearch: MemoSearchPort,
    ) {}

    async execute(input: SearchTasksInput): Promise<{ readonly items: readonly (TaskSearchHit | MemoSearchHit)[] }> {
        const q = input.q.trim();
        if (q.length === 0) return { items: [] };
        const limit = clampSearchLimit(input.limit);
        const [tasks, memos] = await Promise.all([
            this.search.search(input.userId, q, limit),
            this.memoSearch.search({ userId: input.userId, q, limit, hasEvent: false }),
        ]);
        return { items: [...tasks, ...memos] };
    }
}
