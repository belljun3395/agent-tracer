import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Query } from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { SearchEventsUseCase } from "../application/search.events.usecase.js";
import { UpdateEventUseCase } from "../application/update.event.usecase.js";
import { searchQuerySchema, SearchQueryDto } from "./search.query.schema.js";
import { eventPatchSchema, EventPatchDto } from "./event.command.schema.js";

@Controller("api/v1/events")
export class EventController {
    constructor(
        @Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase,
        private readonly updateEvent: UpdateEventUseCase,
    ) {}

    @Get("search")
    async search(@Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQueryDto) {
        return this.searchEvents.execute(query);
    }

    @Patch(":eventId")
    async patchEvent(
        @Param("eventId", pathParamPipe) eventId: string,
        @Body(new ZodValidationPipe(eventPatchSchema)) body: EventPatchDto,
    ) {
        const event = await this.updateEvent.execute({
            eventId,
            ...(body.displayTitle !== undefined ? { displayTitle: body.displayTitle } : {}),
        });
        if (!event) throw new NotFoundException("Event not found");
        return { event };
    }
}
