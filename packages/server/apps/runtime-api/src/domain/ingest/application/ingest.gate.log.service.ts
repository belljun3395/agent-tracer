import { Inject, Injectable } from "@nestjs/common";
import {
    INGEST_EVENT_LOG,
    type BatchRejectedLog,
    type ContractVersionRejectedLog,
    type IngestEventLog,
    type RateLimitedLog,
} from "~runtime-api/domain/ingest/port/ingest.event.log.port.js";

/** 인바운드 게이트가 계층 경계를 지키며 거부 신호를 기록하도록 포트를 감싸는 얇은 응용 서비스다. */
@Injectable()
export class IngestGateLogService {
    constructor(@Inject(INGEST_EVENT_LOG) private readonly ingestLog: IngestEventLog) {}

    contractVersionRejected(entry: ContractVersionRejectedLog): void {
        this.ingestLog.contractVersionRejected(entry);
    }

    batchRejected(entry: BatchRejectedLog): void {
        this.ingestLog.batchRejected(entry);
    }

    rateLimited(entry: RateLimitedLog): void {
        this.ingestLog.rateLimited(entry);
    }
}
