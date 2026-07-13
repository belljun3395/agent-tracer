import { In, type Repository } from "typeorm";
import type { VerdictEntity } from "./verdict.entity.js";
import { upsertByKeys } from "@monitor/tracer-domain/persistence/repository.upsert.js";

export class VerdictRepository {
    constructor(private readonly repo: Repository<VerdictEntity>) {}

    async findByTurn(turnId: string): Promise<VerdictEntity[]> {
        return this.repo.find({ where: { turnId } });
    }

    async findByRuleAndTurns(ruleId: string, turnIds: readonly string[]): Promise<VerdictEntity[]> {
        if (turnIds.length === 0) return [];
        return this.repo.find({ where: { ruleId, turnId: In(turnIds) } });
    }

    async findByTurns(turnIds: readonly string[]): Promise<VerdictEntity[]> {
        if (turnIds.length === 0) return [];
        return this.repo.find({ where: { turnId: In(turnIds) } });
    }

    async upsert(verdict: VerdictEntity): Promise<void> {
        await upsertByKeys(this.repo, verdict, ["turnId", "ruleId"]);
    }
}
