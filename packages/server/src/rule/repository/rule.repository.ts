import { Inject, Injectable } from "@nestjs/common";
import type { IRuleRepository as ILegacyRuleRepository } from "~application/ports/repository/rule.repository.js";
import { RULE_REPOSITORY_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    IRulePersistence,
    RulePersistenceInsertInput,
    RulePersistenceListFilter,
    RulePersistenceRecord,
    RulePersistenceUpdateInput,
} from "../application/outbound/rule.persistence.port.js";

/**
 * Thin adapter exposing IRulePersistence on top of the legacy
 * SqliteRuleRepository. Kept inside the rule module so all rule reads/writes
 * funnel through this single port. Future TypeORM migration replaces the
 * inner without changing callers.
 */
@Injectable()
export class RuleRepository implements IRulePersistence {
    constructor(
        @Inject(RULE_REPOSITORY_TOKEN) private readonly inner: ILegacyRuleRepository,
    ) {}

    findById(id: string): Promise<RulePersistenceRecord | null> {
        return this.inner.findById(id) as Promise<RulePersistenceRecord | null>;
    }

    findBySignature(signature: string): Promise<RulePersistenceRecord | null> {
        return this.inner.findBySignature(signature) as Promise<RulePersistenceRecord | null>;
    }

    findActiveForTurn(taskId: string): Promise<readonly RulePersistenceRecord[]> {
        return this.inner.findActiveForTurn(taskId) as Promise<readonly RulePersistenceRecord[]>;
    }

    list(filter?: RulePersistenceListFilter): Promise<readonly RulePersistenceRecord[]> {
        return this.inner.list(filter as never) as Promise<readonly RulePersistenceRecord[]>;
    }

    insert(input: RulePersistenceInsertInput): Promise<RulePersistenceRecord> {
        return this.inner.insert(input as never) as Promise<RulePersistenceRecord>;
    }

    update(id: string, patch: RulePersistenceUpdateInput, newSignature: string): Promise<RulePersistenceRecord | null> {
        return this.inner.update(id, patch as never, newSignature) as Promise<RulePersistenceRecord | null>;
    }

    softDelete(id: string, deletedAt: string): Promise<boolean> {
        return this.inner.softDelete(id, deletedAt);
    }
}
