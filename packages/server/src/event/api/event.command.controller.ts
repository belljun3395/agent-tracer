import { Body, Controller, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import { IngestEventsUseCase } from "../application/ingest.events.usecase.js";
import { UpdateEventUseCase } from "../application/update.event.usecase.js";
import type { IngestEventsUseCaseIn } from "../application/dto/ingest.events.usecase.dto.js";
import type { UpdateEventUseCaseIn } from "../application/dto/update.event.usecase.dto.js";
import { eventPatchSchema } from "./event.command.schema.js";
import { eventBatchSchema } from "./event.batch.schema.js";

@Controller("api/v1/events")
export class EventCommandController {
    constructor(
        private readonly ingestEvents: IngestEventsUseCase,
        private readonly updateEvent: UpdateEventUseCase,
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
        if (!event) throw new NotFoundException("Event not found");
        return { event };
    }
}
