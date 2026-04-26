import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { IngestEventsUseCase } from "~application/events/index.js";
import type { IngestEventsUseCaseIn } from "~application/events/index.js";
import { ingestEventsBatchSchema } from "~adapters/http/ingest/schemas/event.ingest.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("ingest/v1/events")
export class EventIngestController {
    constructor(@Inject(IngestEventsUseCase) private readonly ingestEvents: IngestEventsUseCase) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async ingestEventsEndpoint(
        @Body(new ZodValidationPipe(ingestEventsBatchSchema, "Invalid request body"))
        body: IngestEventsUseCaseIn,
    ) {
        return this.ingestEvents.execute({ events: body.events });
    }
}
