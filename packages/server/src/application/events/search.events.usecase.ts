import type { EventSearchPort } from "../ports/index.js";
import type { SearchEventsUseCaseIn, SearchEventsUseCaseOut } from "./dto/search.events.usecase.dto.js";

export class SearchEventsUseCase {
    constructor(private readonly eventRepo: EventSearchPort) {}

    async execute(input: SearchEventsUseCaseIn): Promise<SearchEventsUseCaseOut> {
        return this.eventRepo.search(input.query, {
            ...(input.taskId ? { taskId: input.taskId } : {}),
            ...(input.limit ? { limit: input.limit } : {}),
        });
    }
}
