import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ListRulesForTaskUseCase } from "../application/list.rules.usecase.js";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";

@Controller("api/v1/rules")
export class TaskRulesQueryController {
    constructor(
        @Inject(ListRulesForTaskUseCase) private readonly listRulesForTask: ListRulesForTaskUseCase,
    ) {}

    @Get("for-task")
    async listRules(@Query("taskId", pathParamPipe) taskId: string) {
        return this.listRulesForTask.execute({ taskId });
    }
}
