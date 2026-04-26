import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ListRuleCommandsUseCase } from "~application/rule-commands/index.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";

@Controller("api/v1/tasks/:taskId/rule-commands")
export class TaskRuleCommandQueryController {
    constructor(@Inject(ListRuleCommandsUseCase) private readonly listRuleCommands: ListRuleCommandsUseCase) {}

    @Get()
    async listForTask(@Param("taskId", pathParamPipe) taskId: string) {
        const ruleCommands = await this.listRuleCommands.execute({ taskId });
        return { ruleCommands };
    }
}
