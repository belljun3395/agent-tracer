import type {
    IRuleRepository,
    ListRulesFilter,
} from "~application/ports/repository/rule.repository.js";
import type { Rule } from "~domain/verification/index.js";

export interface FlatRulesResult {
    readonly rules: readonly Rule[];
}

/**
 * Lists rules. Always returns a flat `{ rules }` list. Clients group by scope
 * (global vs task) on their side.
 */
export class ListRulesUseCase {
    constructor(private readonly ruleRepo: IRuleRepository) {}

    async execute(filter?: ListRulesFilter): Promise<FlatRulesResult> {
        const rules = await this.ruleRepo.list(filter);
        return { rules };
    }
}
