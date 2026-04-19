import { Controller, Get, Query, HttpException, HttpStatus, Inject } from "@nestjs/common";
import { SearchEventsUseCase } from "~application/events/index.js";
import type { TaskSearchInput } from "~application/events/index.js";
import { searchQuerySchema } from "../schemas/search.query.schema.js";

@Controller()
export class SearchController {
    constructor(@Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase) {}

    @Get("/api/search")
    async search(
        @Query("q") q?: string,
        @Query("taskId") taskId?: string,
        @Query("limit") limit?: string,
    ) {
        const parsed = searchQuerySchema.safeParse({ query: q, taskId, limit });
        if (!parsed.success) {
            throw new HttpException({ error: parsed.error.format() }, HttpStatus.BAD_REQUEST);
        }
        return this.searchEvents.execute(parsed.data as TaskSearchInput);
    }
}
