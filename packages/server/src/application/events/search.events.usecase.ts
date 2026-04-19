import type { IEventRepository, SearchResults } from "../ports/index.js";
import type { TaskSearchInput } from "./event.search.type.js";

export class SearchEventsUseCase {
    constructor(private readonly eventRepo: IEventRepository) {}

    async execute(input: TaskSearchInput): Promise<SearchResults> {
        return this.eventRepo.search(input.query, {
            ...(input.taskId ? { taskId: input.taskId } : {}),
            ...(input.limit ? { limit: input.limit } : {}),
        });
    }
}
