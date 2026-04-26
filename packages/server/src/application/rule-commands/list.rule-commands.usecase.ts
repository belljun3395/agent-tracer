import type { IRuleCommandRepository, RuleCommandRecord } from "~application/ports/index.js";
import type { ListedRuleCommandUseCaseDto, ListRuleCommandsUseCaseIn, ListRuleCommandsUseCaseOut } from "./dto/list.rule-commands.usecase.dto.js";

export class ListRuleCommandsUseCase {
    constructor(private readonly ruleCommands: IRuleCommandRepository) {}

    async execute(input: ListRuleCommandsUseCaseIn): Promise<ListRuleCommandsUseCaseOut> {
        const records = input.taskId
            ? await this.ruleCommands.findByTaskId(input.taskId)
            : await this.ruleCommands.findGlobal();
        return records.map(mapRuleCommandRecord);
    }
}

function mapRuleCommandRecord(record: RuleCommandRecord): ListedRuleCommandUseCaseDto {
    return {
        id: record.id,
        pattern: record.pattern,
        label: record.label,
        ...(record.taskId !== undefined ? { taskId: record.taskId } : {}),
        createdAt: record.createdAt,
    };
}
