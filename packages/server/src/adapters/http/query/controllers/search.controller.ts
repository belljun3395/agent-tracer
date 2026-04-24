import { Controller, Get, Query, Inject } from "@nestjs/common";
import { SearchEventsUseCase } from "~application/events/index.js";
import type { TaskSearchInput } from "~application/events/index.js";
import { searchQuerySchema } from "../schemas/search.query.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller()
export class SearchController {
    constructor(@Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase) {}

    @Get("/api/search")
    async search(@Query(new ZodValidationPipe(searchQuerySchema)) query: TaskSearchInput) {
        return this.searchEvents.execute(query);
    }
}
