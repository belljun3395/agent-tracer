import type { IRuleCommandRepository } from "~application/ports/index.js";

export class DeleteRuleCommandUseCase {
    constructor(private readonly ruleCommands: IRuleCommandRepository) {}

    async execute(id: string): Promise<boolean> {
        return this.ruleCommands.delete(id);
    }
}
