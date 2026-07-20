import { Inject, Injectable } from "@nestjs/common";
import { spanIdOf, traceIdOf, type IngestEvent, type RejectedIngestEvent } from "@monitor/kernel";
import {
    INGEST_EVENT_LOG,
    type IngestEventLog,
} from "~runtime-api/domain/ingest/port/ingest.event.log.port.js";
import {
    LEDGER_EVENT_STORE,
    type LedgerEventRecord,
    type LedgerEventStore,
} from "~runtime-api/domain/ingest/port/ledger.event.store.port.js";

// 턴 span 자신은 id가 turnId와 같아 부모가 없고 트레이스 루트가 된다.
function parentSpanIdOf(event: IngestEvent): string | null {
    if (event.parentId !== undefined) return spanIdOf(event.parentId);
    if (event.turnId !== undefined && event.turnId !== event.id) return spanIdOf(event.turnId);
    return null;
}

// 유스케이스는 config를 모르므로 로그 표현용 문자열 변환을 여기서 직접 한다.
function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "unknown error";
}

@Injectable()
export class AppendEventsUseCase {
    constructor(
        @Inject(LEDGER_EVENT_STORE) private readonly ledger: LedgerEventStore,
        @Inject(INGEST_EVENT_LOG) private readonly ingestLog: IngestEventLog,
    ) {}

    async execute(
        userId: string,
        events: IngestEvent[],
        rejected: readonly RejectedIngestEvent[] = [],
    ): Promise<void> {
        for (const entry of rejected) {
            this.ingestLog.rejected({ userId, eventId: entry.id, reason: entry.reason });
        }
        if (events.length === 0) {
            if (rejected.length > 0) this.ingestLog.allRejected({ userId, count: rejected.length });
            return;
        }
        const rows: LedgerEventRecord[] = events.map((event) => ({
            id: event.id,
            userId,
            taskId: event.taskId,
            sessionId: event.sessionId ?? null,
            kind: event.kind,
            occurredAt: new Date(event.occurredAt),
            traceId: traceIdOf(event.turnId ?? event.sessionId ?? event.taskId),
            spanId: spanIdOf(event.id),
            parentSpanId: parentSpanIdOf(event),
            payload: event.payload,
        }));
        try {
            await this.ledger.appendAll(rows);
        } catch (error) {
            this.ingestLog.appendFailed({ userId, count: rows.length, error: errorMessage(error) });
            throw error;
        }
        this.ingestLog.appended({
            userId,
            count: rows.length,
            taskIds: [...new Set(rows.map((row) => row.taskId))],
            eventIds: rows.map((row) => row.id),
        });
    }
}
