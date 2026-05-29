import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import { IngestEventsUseCase } from "../application/ingest.events.usecase.js";
import { eventBatchSchema as ingestEventsBatchSchema, IngestEventsBatchDto } from "./event.batch.schema.js";

@Controller("ingest/v1/events")
export class EventIngestController {
    constructor(private readonly ingestEvents: IngestEventsUseCase) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async ingestEventsEndpoint(
        @Body(new ZodValidationPipe(ingestEventsBatchSchema, "Invalid request body"))
        body: IngestEventsBatchDto,
    ) {
        return this.ingestEvents.execute({ events: body.events });
    }
}
