import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";

export class DeleteRuleUseCase {
    constructor(private readonly ruleRepo: IRuleRepository) {}

    async execute(id: string): Promise<boolean> {
        return this.ruleRepo.delete(id);
    }
}
