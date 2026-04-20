import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ListRuleCommandsUseCase } from "~application/rule-commands/index.js";

@Controller()
export class RuleCommandController {
    constructor(
        @Inject(ListRuleCommandsUseCase) private readonly listRuleCommands: ListRuleCommandsUseCase,
    ) {}

    @Get("/api/rule-commands")
    async listGlobal() {
        const ruleCommands = await this.listRuleCommands.execute();
        return { ruleCommands };
    }

    @Get("/api/tasks/:taskId/rule-commands")
    async listForTask(@Param("taskId") taskId: string) {
        const ruleCommands = await this.listRuleCommands.execute(taskId);
        return { ruleCommands };
    }
}
