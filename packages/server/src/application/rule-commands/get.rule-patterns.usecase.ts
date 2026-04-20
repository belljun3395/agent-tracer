import type { IRuleCommandRepository } from "~application/ports/index.js";

export class GetRulePatternsUseCase {
    constructor(private readonly ruleCommands: IRuleCommandRepository) {}

    async execute(taskId: string): Promise<readonly string[]> {
        const [global, taskSpecific] = await Promise.all([
            this.ruleCommands.findGlobal(),
            this.ruleCommands.findByTaskId(taskId),
        ]);
        return [...global, ...taskSpecific].map((r) => r.pattern);
    }
}
