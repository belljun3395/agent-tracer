import { Controller, Get, Inject } from "@nestjs/common";
import { ListRuleCommandsUseCase } from "~application/rule-commands/index.js";

@Controller("api/v1/rule-commands")
export class GlobalRuleCommandQueryController {
    constructor(@Inject(ListRuleCommandsUseCase) private readonly listRuleCommands: ListRuleCommandsUseCase) {}

    @Get()
    async listGlobal() {
        const ruleCommands = await this.listRuleCommands.execute({});
        return { ruleCommands };
    }
}
