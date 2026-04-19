import { Controller, Post, Body, HttpException, HttpStatus, HttpCode, Inject } from "@nestjs/common";
import { IngestEventsUseCase } from "~application/events/index.js";
import { ingestEventsBatchSchema } from "../schemas/event.ingest.schema.js";

@Controller("ingest/v1")
export class IngestController {
    constructor(@Inject(IngestEventsUseCase) private readonly ingestEvents: IngestEventsUseCase) {}

    @Post("events")
    @HttpCode(HttpStatus.OK)
    async ingestEventsEndpoint(@Body() body: unknown) {
        const parsed = ingestEventsBatchSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                {
                    ok: false,
                    error: {
                        code: "validation_error",
                        message: "Invalid request body",
                        details: parsed.error.format(),
                    },
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        const result = await this.ingestEvents.execute(parsed.data.events);
        return { ok: true, data: result };
    }
}
