import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type {
    IRuleEnforcementRepository,
    RuleEnforcementInsert,
    RuleEnforcementRow,
} from "~governance/verification/application/outbound/rule.enforcement.repository.port.js";
import { RuleEnforcementEntity } from "../domain/rule.enforcement.entity.js";

@Injectable()
export class RuleEnforcementRepository implements IRuleEnforcementRepository {
    constructor(
        @InjectRepository(RuleEnforcementEntity)
        private readonly repo: Repository<RuleEnforcementEntity>,
    ) {}

    async insert(row: RuleEnforcementInsert): Promise<RuleEnforcementRow | null> {
        const result = await this.repo
            .createQueryBuilder()
            .insert()
            .into(RuleEnforcementEntity)
            .values(row)
            .orIgnore()
            .execute();
        return (result.raw as { changes?: number } | undefined)?.changes && (result.raw as { changes: number }).changes > 0
            ? row
            : null;
    }

    async insertMany(rows: readonly RuleEnforcementInsert[]): Promise<readonly RuleEnforcementRow[]> {
        if (rows.length === 0) return [];
        const inserted: RuleEnforcementRow[] = [];
        await this.repo.manager.transaction(async (manager) => {
            for (const row of rows) {
                const result = await manager
                    .createQueryBuilder()
                    .insert()
                    .into(RuleEnforcementEntity)
                    .values(row)
                    .orIgnore()
                    .execute();
                if ((result.raw as { changes?: number } | undefined)?.changes && (result.raw as { changes: number }).changes > 0) {
                    inserted.push(row);
                }
            }
        });
        return inserted;
    }

    async findByEventId(eventId: string): Promise<readonly RuleEnforcementRow[]> {
        const rows = await this.repo.find({ where: { eventId } });
        return rows.map(mapEntity);
    }

    async findByEventIds(eventIds: readonly string[]): Promise<readonly RuleEnforcementRow[]> {
        if (eventIds.length === 0) return [];
        const rows = await this.repo.find({ where: { eventId: In([...eventIds]) } });
        return rows.map(mapEntity);
    }

    async deleteByRuleId(ruleId: string): Promise<void> {
        await this.repo.delete({ ruleId });
    }

    async eventIdToRuleIds(eventIds: readonly string[]): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
        const map = new Map<string, Set<string>>();
        if (eventIds.length === 0) return map;
        const rows = await this.findByEventIds(eventIds);
        for (const row of rows) {
            let set = map.get(row.eventId);
            if (!set) {
                set = new Set();
                map.set(row.eventId, set);
            }
            set.add(row.ruleId);
        }
        return map;
    }
}

function mapEntity(row: RuleEnforcementEntity): RuleEnforcementRow {
    return {
        eventId: row.eventId,
        ruleId: row.ruleId,
        matchKind: row.matchKind,
        decidedAt: row.decidedAt,
    };
}
