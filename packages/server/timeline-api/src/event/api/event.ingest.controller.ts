import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import type { IIdGenerator } from "@monitor/shared/kernel/clock.js";
import { IngestEventsUseCase } from "../application/ingest.events.usecase.js";
import type { IngestEventsUseCaseEventDto } from "../application/dto/ingest.events.usecase.dto.js";
import { ID_GENERATOR_PORT } from "../application/outbound/tokens.js";
import { eventBatchSchema, EventBatchDto } from "./event.batch.schema.js";

// 혼합 kind 이벤트의 범용 ingest 입구(서버 내부 생산자 — MCP 도구 등). 런타임용 typed 경로와 달리
// 생산자가 id를 보내지 않으므로 서버 엣지에서 ULID를 부여한다.
@Controller("ingest/v1/events")
export class EventIngestController {
    constructor(
        private readonly ingestEvents: IngestEventsUseCase,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async ingestEventsEndpoint(
        @Body(new ZodValidationPipe(eventBatchSchema, "Invalid request body"))
        body: EventBatchDto,
    ) {
        const events = body.events.map(
            (event): IngestEventsUseCaseEventDto =>
                ({ ...event, id: event.id ?? this.idGen.newUlid() }) as IngestEventsUseCaseEventDto,
        );
        return this.ingestEvents.execute({ events });
    }
}
