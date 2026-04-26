import type { IRuleCommandRepository } from "~application/ports/index.js";
import type { GetRulePatternsUseCaseIn, GetRulePatternsUseCaseOut } from "./dto/get.rule-patterns.usecase.dto.js";

export class GetRulePatternsUseCase {
    constructor(private readonly ruleCommands: IRuleCommandRepository) {}

    async execute(input: GetRulePatternsUseCaseIn): Promise<GetRulePatternsUseCaseOut> {
        const [global, taskSpecific] = await Promise.all([
            this.ruleCommands.findGlobal(),
            this.ruleCommands.findByTaskId(input.taskId),
        ]);
        return { patterns: [...global, ...taskSpecific].map((r) => r.pattern) };
    }
}
