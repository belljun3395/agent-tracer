import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
    IVerdictRepository,
    VerdictUpsertInput,
} from "~governance/verification/application/outbound/verdict.repository.port.js";
import type { TurnVerdict, VerdictStatus } from "~governance/verification/domain/model/verdict.model.js";
import { TurnEntity } from "../domain/turn.entity.js";
import { VerdictEntity } from "../domain/verdict.entity.js";

@Injectable()
export class VerdictRepository implements IVerdictRepository {
    constructor(
        @InjectRepository(VerdictEntity)
        private readonly repo: Repository<VerdictEntity>,
    ) {}

    async insert(input: VerdictUpsertInput): Promise<TurnVerdict> {
        const entity = new VerdictEntity();
        entity.turnId = input.turnId;
        entity.ruleId = input.ruleId;
        entity.status = input.status;
        entity.matchedPhrase = input.detail.matchedPhrase ?? null;
        entity.expectedPattern = input.detail.expectedPattern ?? null;
        entity.actualToolCallsJson = input.detail.actualToolCalls
            ? JSON.stringify(input.detail.actualToolCalls)
            : null;
        entity.matchedToolCallsJson = input.detail.matchedToolCalls
            ? JSON.stringify(input.detail.matchedToolCalls)
            : null;
        entity.evaluatedAt = input.evaluatedAt;
        const saved = await this.repo.save(entity);
        // The DB has a composite PK; carry the in-memory id from the input.
        return { ...mapEntity(saved), id: input.id };
    }

    async findByTurnId(turnId: string): Promise<readonly TurnVerdict[]> {
        const rows = await this.repo.find({ where: { turnId } });
        return rows.map(mapEntity);
    }

    async countBySessionAndStatus(sessionId: string, status: VerdictStatus): Promise<number> {
        return this.repo
            .createQueryBuilder("v")
            .innerJoin(TurnEntity, "t", "t.id = v.turn_id")
            .where("t.session_id = :sessionId", { sessionId })
            .andWhere("v.status = :status", { status })
            .getCount();
    }

    async deleteByRuleId(ruleId: string): Promise<void> {
        await this.repo.delete({ ruleId });
    }

    async deleteByTurnId(turnId: string): Promise<void> {
        await this.repo.delete({ turnId });
    }
}

function mapEntity(row: VerdictEntity): TurnVerdict {
    return {
        id: `${row.turnId}:${row.ruleId}`,
        turnId: row.turnId,
        ruleId: row.ruleId,
        status: row.status,
        detail: {
            ...(row.matchedPhrase !== null ? { matchedPhrase: row.matchedPhrase } : {}),
            ...(row.expectedPattern !== null ? { expectedPattern: row.expectedPattern } : {}),
            actualToolCalls: row.actualToolCallsJson
                ? (JSON.parse(row.actualToolCallsJson) as string[])
                : [],
            ...(row.matchedToolCallsJson !== null
                ? { matchedToolCalls: JSON.parse(row.matchedToolCallsJson) as string[] }
                : {}),
        },
        evaluatedAt: row.evaluatedAt,
    };
}
