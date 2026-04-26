import { randomUUID } from "node:crypto";
import type { IRuleCommandRepository, RuleCommandRecord } from "~application/ports/index.js";
import type { CreateRuleCommandUseCaseIn, CreateRuleCommandUseCaseOut } from "./dto/create.rule-command.usecase.dto.js";

export class CreateRuleCommandUseCase {
    constructor(private readonly ruleCommands: IRuleCommandRepository) {}

    async execute(input: CreateRuleCommandUseCaseIn): Promise<CreateRuleCommandUseCaseOut> {
        if (!input.pattern.trim()) throw new Error("Pattern must not be empty");
        if (!input.label.trim()) throw new Error("Label must not be empty");
        return mapRuleCommandRecord(await this.ruleCommands.create({
            id: randomUUID(),
            pattern: input.pattern.trim(),
            label: input.label.trim(),
            ...(input.taskId ? { taskId: input.taskId } : {}),
        }));
    }
}

function mapRuleCommandRecord(record: RuleCommandRecord): CreateRuleCommandUseCaseOut {
    return {
        id: record.id,
        pattern: record.pattern,
        label: record.label,
        ...(record.taskId !== undefined ? { taskId: record.taskId } : {}),
        createdAt: record.createdAt,
    };
}
