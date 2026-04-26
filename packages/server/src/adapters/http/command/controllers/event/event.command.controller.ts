import { Controller, Patch, Post, Body, Param, NotFoundException, Inject, HttpStatus, HttpCode } from "@nestjs/common";
import { UpdateEventUseCase, IngestEventsUseCase } from "~application/events/index.js";
import type { EventPatchInput } from "~application/events/index.js";
import { ingestEventsBatchSchema } from "~adapters/http/ingest/schemas/event.ingest.schema.js";
import { eventPatchSchema } from "~adapters/http/ingest/schemas/event.write.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import type { z } from "zod";

type IngestEventsBatchBody = z.infer<typeof ingestEventsBatchSchema>;

@Controller("api/v1/events")
export class EventCommandController {
    constructor(
        @Inject(UpdateEventUseCase) private readonly updateEvent: UpdateEventUseCase,
        @Inject(IngestEventsUseCase) private readonly ingestEvents: IngestEventsUseCase,
    ) {}

    // web rule action logging
    @Post()
    @HttpCode(HttpStatus.OK)
    async ingestEventsEndpoint(
        @Body(new ZodValidationPipe(ingestEventsBatchSchema, "Invalid request body"))
        body: IngestEventsBatchBody,
    ) {
        return this.ingestEvents.execute(body.events);
    }

    // lets users rename events in the UI via inline editing
    @Patch(":eventId")
    async patchEvent(
        @Param("eventId", pathParamPipe) eventId: string,
        @Body(new ZodValidationPipe(eventPatchSchema)) body: Omit<EventPatchInput, "eventId">,
    ) {
        const event = await this.updateEvent.execute({
            eventId,
            ...(body.displayTitle !== undefined ? { displayTitle: body.displayTitle } : {}),
        } satisfies EventPatchInput);
        if (!event) {
            throw new NotFoundException("Event not found");
        }
        return { event };
    }
}
