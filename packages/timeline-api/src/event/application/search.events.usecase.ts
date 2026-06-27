import { Inject, Injectable } from "@nestjs/common";
import { EVENT_PERSISTENCE_PORT } from "./outbound/tokens.js";
import type { IEventPersistence } from "./outbound/event.persistence.port.js";
import type { SearchEventsUseCaseIn, SearchEventsUseCaseOut } from "./dto/search.events.usecase.dto.js";

@Injectable()
export class SearchEventsUseCase {
    constructor(
        @Inject(EVENT_PERSISTENCE_PORT) private readonly persistence: IEventPersistence,
    ) {}

    async execute(input: SearchEventsUseCaseIn): Promise<SearchEventsUseCaseOut> {
        const result = await this.persistence.search(input.query, {
            ...(input.taskId ? { taskId: input.taskId } : {}),
            ...(input.limit ? { limit: input.limit } : {}),
        });
        return result as SearchEventsUseCaseOut;
    }
}
