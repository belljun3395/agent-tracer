import { BadRequestException, Injectable } from "@nestjs/common";
import type { PipeTransform } from "@nestjs/common";
import { createApiErrorEnvelope, type IngestBatchPartition } from "@monitor/kernel";
import { IngestGateLogService } from "~runtime-api/domain/ingest/application/ingest.gate.log.service.js";
import { ingestBatchRequestSchema } from "./ingest.batch.schema.js";

function batchSizeOf(value: unknown): number | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const events = (value as Record<string, unknown>)["events"];
    return Array.isArray(events) ? events.length : undefined;
}

// 봉투 검증 실패는 배치 전체를 조용히 버리므로 이 게이트가 유일한 관측 지점이다.
@Injectable()
export class IngestBatchValidationPipe implements PipeTransform<unknown, IngestBatchPartition> {
    constructor(private readonly gateLog: IngestGateLogService) {}

    transform(value: unknown): IngestBatchPartition {
        const parsed = ingestBatchRequestSchema.safeParse(value);
        if (parsed.success) return parsed.data;
        const reason = parsed.error.issues[0]?.message ?? "invalid ingest batch";
        this.gateLog.batchRejected({ reason, count: batchSizeOf(value) });
        throw new BadRequestException(
            createApiErrorEnvelope("ingest.invalid", "invalid ingest batch", parsed.error.format()),
        );
    }
}
