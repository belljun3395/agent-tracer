import type { SessionEntity } from "@monitor/tracer-domain";
import type { SessionReaderPort } from "~tracer-api/domain/task/port/session.reader.port.js";

/** 세션 조회 포트의 인메모리 대역이다. */
export class InMemorySessionReader implements SessionReaderPort {
    private readonly rows: SessionEntity[] = [];

    seed(...sessions: readonly SessionEntity[]): void {
        this.rows.push(...sessions);
    }

    all(): readonly SessionEntity[] {
        return [...this.rows];
    }

    findByTask(taskId: string): Promise<SessionEntity[]> {
        const rows = this.rows
            .filter((session) => session.taskId === taskId)
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
        return Promise.resolve(rows);
    }
}
