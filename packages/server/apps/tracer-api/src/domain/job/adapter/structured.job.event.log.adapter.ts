import { Injectable } from "@nestjs/common";
import type {
    JobEnqueuedLog,
    JobEventLog,
    JobIdempotencyConflictLog,
    JobLlmKeyMissingLog,
} from "~tracer-api/domain/job/port/job.event.log.port.js";
import { logInfo, logWarn } from "~tracer-api/config/log.js";

/** Job 큐잉 결과를 구조화된 프로세스 로그로 출력한다. */
@Injectable()
export class StructuredJobEventLogAdapter implements JobEventLog {
    enqueued(entry: JobEnqueuedLog): void {
        logInfo({ msg: "job.enqueued", ...entry });
    }

    idempotencyConflict(entry: JobIdempotencyConflictLog): void {
        logWarn({ msg: "job.idempotencyConflict", ...entry });
    }

    llmKeyMissing(entry: JobLlmKeyMissingLog): void {
        logWarn({ msg: "job.llmKeyMissing", ...entry });
    }
}
