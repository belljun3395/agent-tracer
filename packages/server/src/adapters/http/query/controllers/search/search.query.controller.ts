import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SearchEventsUseCase } from "~application/events/search.events.usecase.js";
import type { SearchEventsUseCaseIn } from "~application/events/dto/search.events.usecase.dto.js";
import { searchQuerySchema } from "~adapters/http/query/schemas/search.query.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1")
export class SearchQueryController {
    constructor(@Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase) {}

    @Get("search")
    async search(@Query(new ZodValidationPipe(searchQuerySchema)) query: SearchEventsUseCaseIn) {
        return this.searchEvents.execute(query);
    }
}
