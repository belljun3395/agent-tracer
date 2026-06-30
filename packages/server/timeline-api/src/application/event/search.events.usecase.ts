import { Inject, Injectable } from "@nestjs/common";
import { EVENT_SEARCH_INDEX_PORT } from "@monitor/timeline-api/application/event/outbound/tokens.js";
import type { IEventSearchIndex } from "@monitor/timeline-api/application/event/outbound/event.search.index.port.js";
import type { SearchEventsUseCaseIn, SearchEventsUseCaseOut } from "@monitor/timeline-api/application/event/dto/search.events.usecase.dto.js";

@Injectable()
export class SearchEventsUseCase {
    constructor(
        @Inject(EVENT_SEARCH_INDEX_PORT) private readonly searchIndex: IEventSearchIndex,
    ) {}

    async execute(input: SearchEventsUseCaseIn): Promise<SearchEventsUseCaseOut> {
        const result = await this.searchIndex.search(input.query, {
            ...(input.taskId ? { taskId: input.taskId } : {}),
            ...(input.limit ? { limit: input.limit } : {}),
        });
        return result as SearchEventsUseCaseOut;
    }
}
