import { Injectable } from "@nestjs/common";
import { TaskQueryService } from "../service/task.query.service.js";

export interface TaskSearchHit {
    readonly id: string;
    readonly taskId: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly status: "running" | "waiting" | "completed" | "errored";
    readonly updatedAt: string;
}

export interface SearchTasksUseCaseIn {
    readonly query: string;
    readonly limit?: number;
}

export interface SearchTasksUseCaseOut {
    readonly tasks: readonly TaskSearchHit[];
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 8;

/**
 * Task full-text search (pg_trgm ILIKE). Work owns task search; timeline owns
 * event search. The web fans out to both and merges.
 */
@Injectable()
export class SearchTasksUseCase {
    constructor(private readonly query: TaskQueryService) {}

    async execute(input: SearchTasksUseCaseIn): Promise<SearchTasksUseCaseOut> {
        const q = input.query.trim();
        if (!q) return { tasks: [] };
        const limit = Math.max(1, Math.min(MAX_LIMIT, input.limit ?? DEFAULT_LIMIT));
        const entities = await this.query.searchTasks(q, limit);
        return {
            tasks: entities.map((e) => ({
                id: e.id,
                taskId: e.id,
                title: e.title,
                status: e.status,
                updatedAt: e.updatedAt,
                ...(e.workspacePath ? { workspacePath: e.workspacePath } : {}),
            })),
        };
    }
}
