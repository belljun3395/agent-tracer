import type { IRuleCommandRepository, RuleCommandRecord } from "~application/ports/index.js";

export class ListRuleCommandsUseCase {
    constructor(private readonly ruleCommands: IRuleCommandRepository) {}

    async execute(taskId?: string): Promise<readonly RuleCommandRecord[]> {
        if (taskId) return this.ruleCommands.findByTaskId(taskId);
        return this.ruleCommands.findGlobal();
    }
}
