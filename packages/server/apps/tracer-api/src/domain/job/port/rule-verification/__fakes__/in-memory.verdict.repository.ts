import type { VerdictEntity } from "@monitor/tracer-domain";
import type { VerdictRepositoryPort } from "../verdict.repository.port.js";

/** 판정 저장소 포트의 인메모리 대역이다. */
export class InMemoryVerdictRepository implements VerdictRepositoryPort {
    private readonly rows = new Map<string, VerdictEntity>();

    seed(...verdicts: readonly VerdictEntity[]): void {
        for (const verdict of verdicts) this.rows.set(verdict.ruleId, verdict);
    }

    all(): VerdictEntity[] {
        return [...this.rows.values()];
    }

    findByRule(ruleId: string): Promise<VerdictEntity | null> {
        return Promise.resolve(this.rows.get(ruleId) ?? null);
    }

    findByRules(ruleIds: readonly string[]): Promise<VerdictEntity[]> {
        return Promise.resolve(this.all().filter((verdict) => ruleIds.includes(verdict.ruleId)));
    }

    findByTurn(turnId: string): Promise<VerdictEntity[]> {
        return Promise.resolve(this.all().filter((verdict) => verdict.turnId === turnId));
    }

    findByTurns(turnIds: readonly string[]): Promise<VerdictEntity[]> {
        return Promise.resolve(this.all().filter((verdict) => turnIds.includes(verdict.turnId)));
    }

    upsert(verdict: VerdictEntity): Promise<void> {
        this.rows.set(verdict.ruleId, verdict);
        return Promise.resolve();
    }
}
