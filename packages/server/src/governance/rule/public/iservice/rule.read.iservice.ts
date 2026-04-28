import type { RuleSnapshot, RuleSnapshotListFilter } from "../dto/rule.snapshot.dto.js";

/**
 * Public iservice — read access to rules.
 * Consumed by the verification module to load rules during evaluation.
 */
export interface IRuleRead {
    findById(id: string): Promise<RuleSnapshot | null>;
    list(filter?: RuleSnapshotListFilter): Promise<readonly RuleSnapshot[]>;
    findActiveForTurn(taskId: string): Promise<readonly RuleSnapshot[]>;
}
