import { Body, Controller, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { IngestEventsUseCase, UpdateEventUseCase } from "~application/events/index.js";
import type { IngestEventsUseCaseIn, UpdateEventUseCaseIn } from "~application/events/index.js";
import { eventPatchSchema } from "~adapters/http/command/schemas/event.command.schema.js";
import { eventBatchSchema } from "~adapters/http/shared/schemas/event-batch.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/events")
export class EventCommandController {
    constructor(
        @Inject(IngestEventsUseCase) private readonly ingestEvents: IngestEventsUseCase,
        @Inject(UpdateEventUseCase) private readonly updateEvent: UpdateEventUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async ingestEventsEndpoint(
        @Body(new ZodValidationPipe(eventBatchSchema, "Invalid request body"))
        body: IngestEventsUseCaseIn,
    ) {
        return this.ingestEvents.execute({ events: body.events });
    }

    @Patch(":eventId")
    async patchEvent(
        @Param("eventId", pathParamPipe) eventId: string,
        @Body(new ZodValidationPipe(eventPatchSchema)) body: Omit<UpdateEventUseCaseIn, "eventId">,
    ) {
        const event = await this.updateEvent.execute({
            eventId,
            ...(body.displayTitle !== undefined ? { displayTitle: body.displayTitle } : {}),
        });
        if (!event) {
            throw new NotFoundException("Event not found");
        }
        return { event };
    }
}
