import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SearchEventsUseCase } from "~application/events/index.js";
import type { TaskSearchInput } from "~application/events/index.js";
import { searchQuerySchema } from "~adapters/http/query/schemas/search.query.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1")
export class SearchQueryController {
    constructor(@Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase) {}

    // [caller: web] GET /api/v1/search — full-text event search used by the search bar in the UI
    @Get("search")
    async search(@Query(new ZodValidationPipe(searchQuerySchema)) query: TaskSearchInput) {
        return this.searchEvents.execute(query);
    }
}
