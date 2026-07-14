import { In, type Repository } from "typeorm";
import type { VerdictEntity } from "./verdict.entity.js";
import { upsertByKeys } from "@monitor/tracer-domain/persistence/repository.upsert.js";

export class VerdictRepository {
    constructor(private readonly repo: Repository<VerdictEntity>) {}

    async findByRule(ruleId: string): Promise<VerdictEntity | null> {
        return this.repo.findOne({ where: { ruleId } });
    }

    async findByRules(ruleIds: readonly string[]): Promise<VerdictEntity[]> {
        if (ruleIds.length === 0) return [];
        return this.repo.find({ where: { ruleId: In(ruleIds) } });
    }

    async findByTurn(turnId: string): Promise<VerdictEntity[]> {
        return this.repo.find({ where: { turnId } });
    }

    async findByTurns(turnIds: readonly string[]): Promise<VerdictEntity[]> {
        if (turnIds.length === 0) return [];
        return this.repo.find({ where: { turnId: In(turnIds) } });
    }

    async upsert(verdict: VerdictEntity): Promise<void> {
        await upsertByKeys(this.repo, verdict, ["ruleId"]);
    }
}
