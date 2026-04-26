import { Controller, Post, Body, HttpStatus, HttpCode, Inject } from "@nestjs/common";
import type { z } from "zod";
import { IngestEventsUseCase } from "~application/events/index.js";
import { ingestEventsBatchSchema } from "~adapters/http/ingest/schemas/event.ingest.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

type IngestEventsBatchBody = z.infer<typeof ingestEventsBatchSchema>;

@Controller("ingest/v1/events")
export class EventIngestController {
    constructor(@Inject(IngestEventsUseCase) private readonly ingestEvents: IngestEventsUseCase) {}

    // mcp tools use this for all event kinds, web uses it for rule action logging
    @Post()
    @HttpCode(HttpStatus.OK)
    async ingestEventsEndpoint(
        @Body(new ZodValidationPipe(ingestEventsBatchSchema, "Invalid request body"))
        body: IngestEventsBatchBody,
    ) {
        return this.ingestEvents.execute(body.events);
    }
}
