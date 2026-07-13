import { Injectable } from "@nestjs/common";
import type {
    AppendedIngestLog,
    IngestEventLog,
    RejectedIngestLog,
} from "~runtime-api/domain/ingest/port/ingest.event.log.port.js";
import { logError, logInfo } from "~runtime-api/config/log.js";

/** 인제스트 결과를 구조화된 프로세스 로그로 출력한다. */
@Injectable()
export class StructuredIngestEventLogAdapter implements IngestEventLog {
    rejected(entry: RejectedIngestLog): void {
        logError({ msg: "ingest.rejected", ...entry });
    }

    appended(entry: AppendedIngestLog): void {
        logInfo({ msg: "ingest.appended", ...entry });
    }
}
