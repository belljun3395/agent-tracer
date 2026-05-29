import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SearchEventsUseCase } from "../application/search.events.usecase.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import { searchQuerySchema, SearchQueryDto } from "./search.query.schema.js";

@Controller("api/v1")
export class SearchQueryController {
    constructor(@Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase) {}

    @Get("search")
    async search(@Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQueryDto) {
        return this.searchEvents.execute(query);
    }
}
