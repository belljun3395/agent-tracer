import { randomUUID } from "node:crypto";
import type { IRuleCommandRepository, RuleCommandRecord } from "~application/ports/index.js";

export interface CreateRuleCommandInput {
    readonly pattern: string;
    readonly label: string;
    readonly taskId?: string;
}

export class CreateRuleCommandUseCase {
    constructor(private readonly ruleCommands: IRuleCommandRepository) {}

    async execute(input: CreateRuleCommandInput): Promise<RuleCommandRecord> {
        if (!input.pattern.trim()) throw new Error("Pattern must not be empty");
        if (!input.label.trim()) throw new Error("Label must not be empty");
        return this.ruleCommands.create({
            id: randomUUID(),
            pattern: input.pattern.trim(),
            label: input.label.trim(),
            ...(input.taskId ? { taskId: input.taskId } : {}),
        });
    }
}
