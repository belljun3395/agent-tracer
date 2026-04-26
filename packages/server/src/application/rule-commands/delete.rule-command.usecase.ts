import type { IRuleCommandRepository } from "~application/ports/index.js";
import type { DeleteRuleCommandUseCaseIn, DeleteRuleCommandUseCaseOut } from "./dto/delete.rule-command.usecase.dto.js";

export class DeleteRuleCommandUseCase {
    constructor(private readonly ruleCommands: IRuleCommandRepository) {}

    async execute(input: DeleteRuleCommandUseCaseIn): Promise<DeleteRuleCommandUseCaseOut> {
        return { deleted: await this.ruleCommands.delete(input.id) };
    }
}
