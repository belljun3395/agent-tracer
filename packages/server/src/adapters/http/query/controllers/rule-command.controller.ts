import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ListRuleCommandsUseCase } from "~application/rule-commands/index.js";

@Controller("api/rule-commands")
export class GlobalRuleCommandController {
    constructor(
        @Inject(ListRuleCommandsUseCase) private readonly listRuleCommands: ListRuleCommandsUseCase,
    ) {}

    @Get()
    async listGlobal() {
        const ruleCommands = await this.listRuleCommands.execute();
        return { ruleCommands };
    }
}

@Controller("api/tasks/:taskId/rule-commands")
export class TaskRuleCommandController {
    constructor(
        @Inject(ListRuleCommandsUseCase) private readonly listRuleCommands: ListRuleCommandsUseCase,
    ) {}

    @Get()
    async listForTask(@Param("taskId") taskId: string) {
        const ruleCommands = await this.listRuleCommands.execute(taskId);
        return { ruleCommands };
    }
}
