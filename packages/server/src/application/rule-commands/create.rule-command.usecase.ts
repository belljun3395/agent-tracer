import { randomUUID } from "node:crypto";
import type { IRuleCommandRepository, RuleCommandRecord } from "~application/ports/index.js";
import { createRuleCommandDraft } from "~domain/rule-commands/index.js";
import type { CreateRuleCommandUseCaseIn, CreateRuleCommandUseCaseOut } from "./dto/create.rule-command.usecase.dto.js";

export class CreateRuleCommandUseCase {
    constructor(private readonly ruleCommands: IRuleCommandRepository) {}

    async execute(input: CreateRuleCommandUseCaseIn): Promise<CreateRuleCommandUseCaseOut> {
        const draft = createRuleCommandDraft(input);
        return mapRuleCommandRecord(await this.ruleCommands.create({
            id: randomUUID(),
            ...draft,
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
