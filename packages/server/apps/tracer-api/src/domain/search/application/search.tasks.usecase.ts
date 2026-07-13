import { Inject, Injectable } from "@nestjs/common";
import { clampSearchLimit } from "~tracer-api/support/search.limit.js";
import { TASK_SEARCH, type TaskSearchHit, type TaskSearchPort } from "~tracer-api/domain/search/port/task.search.port.js";

export interface SearchTasksInput {
    readonly userId: string;
    readonly q: string;
    readonly limit?: number;
}

@Injectable()
export class SearchTasksUseCase {
    constructor(@Inject(TASK_SEARCH) private readonly search: TaskSearchPort) {}

    async execute(input: SearchTasksInput): Promise<{ readonly items: readonly TaskSearchHit[] }> {
        const q = input.q.trim();
        if (q.length === 0) return { items: [] };
        const items = await this.search.search(input.userId, q, clampSearchLimit(input.limit));
        return { items };
    }
}
