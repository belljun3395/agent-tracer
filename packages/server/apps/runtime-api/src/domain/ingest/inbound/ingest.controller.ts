import { Body, Controller, Headers, HttpCode, Post } from "@nestjs/common";
import {
    DEFAULT_USER_ID,
    MONITOR_USER_HEADER,
    type IngestBatchPartition,
    type RejectedIngestEvent,
} from "@monitor/kernel";
import { AppendEventsUseCase } from "~runtime-api/domain/ingest/application/append.events.usecase.js";
import { SchemaValidationPipe } from "~runtime-api/support/schema.validation.pipe.js";
import { ContractVersionPipe } from "./contract.version.pipe.js";
import { ingestBatchRequestSchema } from "./ingest.batch.schema.js";

/** 수용한 이벤트 수와 거부된 레코드를 함께 알리는 인제스트 응답이다. */
export interface IngestBatchResponse {
    readonly accepted: number;
    readonly rejected: readonly RejectedIngestEvent[];
}

@Controller("ingest/v1")
export class IngestController {
    constructor(private readonly appendEvents: AppendEventsUseCase) {}

    @Post("events")
    @HttpCode(202)
    async ingest(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(
            new ContractVersionPipe(),
            new SchemaValidationPipe(ingestBatchRequestSchema, "ingest.invalid", "invalid ingest batch"),
        )
        batch: IngestBatchPartition,
    ): Promise<IngestBatchResponse> {
        const userId = user ?? DEFAULT_USER_ID;
        await this.appendEvents.execute(userId, batch.accepted, batch.rejected);
        return { accepted: batch.accepted.length, rejected: batch.rejected };
    }
}
