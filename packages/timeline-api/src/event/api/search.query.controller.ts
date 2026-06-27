import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SearchEventsUseCase } from "../application/search.events.usecase.js";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { searchQuerySchema, SearchQueryDto } from "./search.query.schema.js";

// Event full-text search under the events namespace. Task search is a separate
// endpoint owned by work (/api/v1/tasks/search); the web fans out to both.
@Controller("api/v1/events")
export class SearchQueryController {
    constructor(@Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase) {}

    @Get("search")
    async search(@Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQueryDto) {
        return this.searchEvents.execute(query);
    }
}
