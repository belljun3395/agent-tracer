import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository, type FindOptionsWhere } from "typeorm";
import { normalizeRuleExpectedAction } from "~verification/domain/tool-action.matching.js";
import { RuleEntity } from "../domain/rule.entity.js";
import type {
    IRulePersistence,
    RulePersistenceInsertInput,
    RulePersistenceListFilter,
    RulePersistenceRecord,
    RulePersistenceUpdateInput,
} from "../application/outbound/rule.persistence.port.js";

/**
 * TypeORM-backed rule repository. Implements IRulePersistence directly —
 * no legacy bridge.
 */
@Injectable()
export class RuleRepository implements IRulePersistence {
    constructor(
        @InjectRepository(RuleEntity)
        private readonly repo: Repository<RuleEntity>,
    ) {}

    async findById(id: string): Promise<RulePersistenceRecord | null> {
        const row = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
        return row ? mapRow(row) : null;
    }

    async findBySignature(signature: string): Promise<RulePersistenceRecord | null> {
        const row = await this.repo.findOne({ where: { signature, deletedAt: IsNull() } });
        return row ? mapRow(row) : null;
    }

    async findActiveForTurn(taskId: string): Promise<readonly RulePersistenceRecord[]> {
        const rows = await this.repo
            .createQueryBuilder("r")
            .where("r.deleted_at IS NULL")
            .andWhere("(r.scope = 'global' OR (r.scope = 'task' AND r.task_id = :taskId))", { taskId })
            .orderBy("r.created_at", "ASC")
            .getMany();
        return rows.map(mapRow);
    }

    async list(filter?: RulePersistenceListFilter): Promise<readonly RulePersistenceRecord[]> {
        const where: FindOptionsWhere<RuleEntity> = { deletedAt: IsNull() };
        if (filter?.scope) where.scope = filter.scope;
        if (filter?.taskId) where.taskId = filter.taskId;
        if (filter?.source) where.source = filter.source;
        const rows = await this.repo.find({ where, order: { createdAt: "DESC" } });
        return rows.map(mapRow);
    }

    async insert(input: RulePersistenceInsertInput): Promise<RulePersistenceRecord> {
        const entity = new RuleEntity();
        entity.id = input.id;
        entity.name = input.name;
        entity.triggerPhrasesJson = input.trigger ? JSON.stringify(input.trigger.phrases) : null;
        entity.triggerOn = input.triggerOn ?? null;
        entity.expectTool = input.expect.action ?? null;
        entity.expectCommandMatchesJson = input.expect.commandMatches
            ? JSON.stringify(input.expect.commandMatches)
            : null;
        entity.expectPattern = input.expect.pattern ?? null;
        entity.scope = input.scope;
        entity.taskId = input.taskId ?? null;
        entity.source = input.source;
        entity.severity = input.severity;
        entity.rationale = input.rationale ?? null;
        entity.signature = input.signature;
        entity.createdAt = input.createdAt;
        entity.deletedAt = null;
        const saved = await this.repo.save(entity);
        return mapRow(saved);
    }

    async update(
        id: string,
        patch: RulePersistenceUpdateInput,
        newSignature: string,
    ): Promise<RulePersistenceRecord | null> {
        const values: Partial<RuleEntity> = { signature: newSignature };
        if (patch.name !== undefined) values.name = patch.name;
        if (patch.severity !== undefined) values.severity = patch.severity;
        if (patch.rationale !== undefined) values.rationale = patch.rationale;
        if (patch.triggerOn !== undefined) values.triggerOn = patch.triggerOn;
        if (patch.trigger !== undefined) {
            values.triggerPhrasesJson = patch.trigger ? JSON.stringify(patch.trigger.phrases) : null;
        }
        if (patch.expect !== undefined) {
            if (patch.expect.action !== undefined) values.expectTool = patch.expect.action;
            if (patch.expect.commandMatches !== undefined) {
                values.expectCommandMatchesJson = patch.expect.commandMatches
                    ? JSON.stringify(patch.expect.commandMatches)
                    : null;
            }
            if (patch.expect.pattern !== undefined) values.expectPattern = patch.expect.pattern;
        }
        const result = await this.repo
            .createQueryBuilder()
            .update(RuleEntity)
            .set(values)
            .where("id = :id AND deleted_at IS NULL", { id })
            .execute();
        if (!result.affected || result.affected === 0) return null;
        return this.findById(id);
    }

    async softDelete(id: string, deletedAt: string): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update(RuleEntity)
            .set({ deletedAt })
            .where("id = :id AND deleted_at IS NULL", { id })
            .execute();
        return Boolean(result.affected && result.affected > 0);
    }
}

function mapRow(row: RuleEntity): RulePersistenceRecord {
    const action = row.expectTool !== null ? normalizeRuleExpectedAction(row.expectTool) : null;
    return {
        id: row.id,
        name: row.name,
        ...(row.triggerPhrasesJson
            ? { trigger: { phrases: JSON.parse(row.triggerPhrasesJson) as readonly string[] } }
            : {}),
        ...(row.triggerOn === "user" || row.triggerOn === "assistant"
            ? { triggerOn: row.triggerOn }
            : {}),
        expect: {
            ...(action !== null ? { action } : {}),
            ...(row.expectCommandMatchesJson !== null
                ? { commandMatches: JSON.parse(row.expectCommandMatchesJson) as readonly string[] }
                : {}),
            ...(row.expectPattern !== null ? { pattern: row.expectPattern } : {}),
        },
        scope: row.scope,
        ...(row.taskId !== null ? { taskId: row.taskId } : {}),
        source: row.source,
        severity: row.severity,
        ...(row.rationale !== null ? { rationale: row.rationale } : {}),
        signature: row.signature,
        createdAt: row.createdAt,
    };
}
