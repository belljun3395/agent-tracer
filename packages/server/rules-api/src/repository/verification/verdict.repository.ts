import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
    IVerdictRepository,
    VerdictUpsertInput,
} from "@monitor/rules-api/application/verification/outbound/verdict.repository.port.js";
import type { TurnVerdict, VerdictStatus } from "@monitor/rules-api/domain/verification/type/verdict.type.js";
import { TurnEntity } from "../../domain/verification/turn.entity.js";
import { VerdictEntity } from "../../domain/verification/verdict.entity.js";

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

        return mapEntity(saved);
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
                ? parseStringArray(row.actualToolCallsJson)
                : [],
            ...(row.matchedToolCallsJson !== null
                ? { matchedToolCalls: parseStringArray(row.matchedToolCallsJson) }
                : {}),
        },
        evaluatedAt: row.evaluatedAt,
    };
}

function parseStringArray(raw: string): string[] {
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((item): item is string => typeof item === "string")
            : [];
    } catch {
        return [];
    }
}
