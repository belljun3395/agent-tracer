import type { VerdictEntity } from "@monitor/tracer-domain";
import type { VerdictRepositoryPort } from "~tracer-api/domain/job/port/rule-verification/verdict.repository.port.js";

/** 판정 저장소 포트의 인메모리 대역이다. */
export class InMemoryVerdictRepository implements VerdictRepositoryPort {
    private readonly rows = new Map<string, VerdictEntity>();

    seed(...verdicts: readonly VerdictEntity[]): void {
        for (const verdict of verdicts) this.rows.set(key(verdict.turnId, verdict.ruleId), verdict);
    }

    all(): VerdictEntity[] {
        return [...this.rows.values()];
    }

    findByTurn(turnId: string): Promise<VerdictEntity[]> {
        return Promise.resolve(this.all().filter((verdict) => verdict.turnId === turnId));
    }

    findByTurns(turnIds: readonly string[]): Promise<VerdictEntity[]> {
        return Promise.resolve(this.all().filter((verdict) => turnIds.includes(verdict.turnId)));
    }

    findByRuleAndTurns(ruleId: string, turnIds: readonly string[]): Promise<VerdictEntity[]> {
        const rows = this.all().filter((verdict) => verdict.ruleId === ruleId && turnIds.includes(verdict.turnId));
        return Promise.resolve(rows);
    }

    upsert(verdict: VerdictEntity): Promise<void> {
        this.rows.set(key(verdict.turnId, verdict.ruleId), verdict);
        return Promise.resolve();
    }
}

function key(turnId: string, ruleId: string): string {
    return `${turnId}:${ruleId}`;
}
