import { Injectable } from "@nestjs/common";
import { parseStoredEventPayload } from "@monitor/kernel/ingest/stored-event.schema.js";
import { SESSION_STATUS, SessionEntity, type TaskEntity } from "@monitor/tracer-domain";
import type { RunProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { RunTaskProjection } from "./run.task.projection.js";

export interface SessionStartProjection {
    readonly task: TaskEntity;
    readonly taskCreated: boolean;
}

/** 실행 이벤트에서 세션 읽기 모델의 시작과 종료를 투영한다. */
@Injectable()
export class RunSessionProjection {
    constructor(private readonly tasks: RunTaskProjection) {}

    async projectStarted(
        repositories: RunProjectionRepositories,
        record: LedgerRecord,
    ): Promise<SessionStartProjection> {
        const { task, created } = await this.tasks.projectSessionStart(repositories, record);
        if (record.sessionId !== null) {
            const existing = await repositories.sessions.findById(record.sessionId);
            if (existing === null) {
                await repositories.sessions.upsert(this.buildSession(record, record.sessionId));
            }
        }
        return { task, taskCreated: created };
    }

    async projectEnded(repositories: RunProjectionRepositories, record: LedgerRecord): Promise<void> {
        if (record.sessionId === null) return;
        const session = await repositories.sessions.findById(record.sessionId);
        if (session === null) return;
        session.end(parseStoredEventPayload(record.payload).summary ?? null, record.occurredAt);
        await repositories.sessions.upsert(session);
    }

    private buildSession(record: LedgerRecord, sessionId: string): SessionEntity {
        const payload = parseStoredEventPayload(record.payload);
        const session = new SessionEntity();
        session.id = sessionId;
        session.taskId = record.taskId;
        session.runtimeSource = payload.runtimeSource ?? "";
        session.runtimeSessionId = payload.runtimeSessionId ?? "";
        session.status = SESSION_STATUS.active;
        session.summary = null;
        session.startedAt = record.occurredAt;
        session.endedAt = null;
        return session;
    }
}
