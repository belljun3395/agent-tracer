import type { VerdictEntity } from "@monitor/tracer-domain";
import type { VerdictReaderPort } from "~tracer-api/domain/task/port/verdict.reader.port.js";

/** 판정 조회 포트의 인메모리 대역이다. */
export class InMemoryVerdictReader implements VerdictReaderPort {
    private readonly rows: VerdictEntity[] = [];

    seed(...verdicts: readonly VerdictEntity[]): void {
        this.rows.push(...verdicts);
    }

    all(): readonly VerdictEntity[] {
        return [...this.rows];
    }

    findByTurn(turnId: string): Promise<VerdictEntity[]> {
        return Promise.resolve(this.rows.filter((verdict) => verdict.turnId === turnId));
    }

    findByTurns(turnIds: readonly string[]): Promise<VerdictEntity[]> {
        const ids = new Set(turnIds);
        return Promise.resolve(this.rows.filter((verdict) => ids.has(verdict.turnId)));
    }
}
