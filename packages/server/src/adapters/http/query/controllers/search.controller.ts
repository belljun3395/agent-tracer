import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SearchEventsUseCase } from "~application/events/index.js";
import type { SearchEventsUseCaseIn } from "~application/events/index.js";
import { searchQuerySchema } from "../schemas/search.query.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api")
export class SearchController {
    constructor(@Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase) {}

    @Get("search")
    async search(@Query(new ZodValidationPipe(searchQuerySchema)) query: SearchEventsUseCaseIn) {
        const input = query satisfies SearchEventsUseCaseIn;
        return this.searchEvents.execute(input);
    }
}
