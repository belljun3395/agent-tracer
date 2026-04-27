import type {
    RuleSnapshot,
    RuleSnapshotInsertInput,
    RuleSnapshotUpdateInput,
} from "../dto/rule.snapshot.dto.js";

/**
 * Public iservice — write access to rules.
 * Used by the verification module's update flow to invalidate verdicts/
 * enforcements when a rule's content changes.
 */
export interface IRuleWrite {
    insert(input: RuleSnapshotInsertInput): Promise<RuleSnapshot>;
    update(id: string, patch: RuleSnapshotUpdateInput, newSignature: string): Promise<RuleSnapshot | null>;
    softDelete(id: string, deletedAt: string): Promise<boolean>;
}
