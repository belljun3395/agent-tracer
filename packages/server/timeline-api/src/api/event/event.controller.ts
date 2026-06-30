import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Query } from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { SearchEventsUseCase } from "@monitor/timeline-api/application/event/search.events.usecase.js";
import { UpdateEventUseCase } from "@monitor/timeline-api/application/event/update.event.usecase.js";
import { searchQuerySchema, SearchQueryDto } from "@monitor/timeline-api/api/event/search.query.schema.js";
import { eventPatchSchema, EventPatchDto } from "@monitor/timeline-api/api/event/event.command.schema.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/public/event/tokens.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/event/iservice/timeline.event.read.iservice.js";

@Controller("api/v1/events")
export class EventController {
    constructor(
        @Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase,
        private readonly updateEvent: UpdateEventUseCase,
        @Inject(TIMELINE_EVENT_READ) private readonly eventRead: ITimelineEventRead,
    ) {}

    @Get()
    async listByTask(
        @Query("taskId", pathParamPipe) taskId: string,
        @Query("limit") limitRaw?: string,
    ) {
        const limit = Math.min(parseInt(limitRaw ?? "200", 10) || 200, 300);
        const events = await this.eventRead.findByTaskId(taskId);
        return events.slice(0, limit);
    }

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
