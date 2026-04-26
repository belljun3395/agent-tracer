import { Controller, Post, Body, HttpStatus, HttpCode, Inject } from "@nestjs/common";
import type { z } from "zod";
import { IngestEventsUseCase } from "~application/events/index.js";
import type { IngestEventsUseCaseIn } from "~application/events/index.js";
import { ingestEventsBatchSchema } from "../schemas/event.ingest.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

type IngestEventsBatchBody = z.infer<typeof ingestEventsBatchSchema>;

@Controller("ingest/v1")
export class IngestController {
    constructor(@Inject(IngestEventsUseCase) private readonly ingestEvents: IngestEventsUseCase) {}

    @Post("events")
    @HttpCode(HttpStatus.OK)
    async ingestEventsEndpoint(
        @Body(new ZodValidationPipe(ingestEventsBatchSchema, "Invalid request body"))
        body: IngestEventsBatchBody,
    ) {
        const input = { events: body.events } satisfies IngestEventsUseCaseIn;
        return this.ingestEvents.execute(input);
    }
}
