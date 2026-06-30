import type { RuleSnapshot, RuleSnapshotListFilter } from "../dto/rule.snapshot.dto.js";

export interface IRuleRead {
    findById(id: string): Promise<RuleSnapshot | null>;
    list(filter?: RuleSnapshotListFilter): Promise<readonly RuleSnapshot[]>;
    findActiveForTurn(taskId: string): Promise<readonly RuleSnapshot[]>;
}
