import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { IngestEventsUseCase } from "~application/events/ingest.events.usecase.js";
import type { IngestEventsUseCaseIn } from "~application/events/dto/ingest.events.usecase.dto.js";
import { eventBatchSchema as ingestEventsBatchSchema } from "~adapters/http/shared/schemas/event-batch.schema.js";
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
