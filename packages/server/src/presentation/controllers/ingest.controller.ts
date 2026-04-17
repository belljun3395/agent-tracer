import { Controller, Post, Body, HttpException, HttpStatus, HttpCode } from "@nestjs/common"
import type { MonitorServiceProvider } from "../service/monitor-service.provider.js"
import { EventIngestionService } from "@monitor/application"
import { ingestEventsBatchSchema } from "../schemas.ingest.js"

@Controller("ingest/v1")
export class IngestController {
    private readonly ingestionService: EventIngestionService

    constructor(service: MonitorServiceProvider) {
        this.ingestionService = new EventIngestionService(service)
    }

    @Post("events")
    @HttpCode(HttpStatus.OK)
    async ingestEvents(@Body() body: unknown) {
        const parsed = ingestEventsBatchSchema.safeParse(body)
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
            )
        }

        const result = await this.ingestionService.ingest(parsed.data.events)
        return { ok: true, data: result }
    }
}
