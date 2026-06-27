import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ListRulesForTaskUseCase } from "../application/list.rules.usecase.js";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";

@Controller("api/v1/tasks/:id")
export class TaskRulesQueryController {
    constructor(
        @Inject(ListRulesForTaskUseCase) private readonly listRulesForTask: ListRulesForTaskUseCase,
    ) {}

    @Get("rules")
    async listRules(@Param("id", pathParamPipe) taskId: string) {
        return this.listRulesForTask.execute({ taskId });
    }
}
