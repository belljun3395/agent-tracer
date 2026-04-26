import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ListRulesForTaskUseCase } from "~application/rules/index.js";
import { GetVerdictCountsForTaskUseCase } from "~application/verification/get.verdict.counts.for.task.usecase.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";

@Controller("api/v1/tasks/:id")
export class TaskRulesQueryController {
    constructor(
        @Inject(ListRulesForTaskUseCase) private readonly listRulesForTask: ListRulesForTaskUseCase,
        @Inject(GetVerdictCountsForTaskUseCase)
        private readonly getVerdictCounts: GetVerdictCountsForTaskUseCase,
    ) {}

    @Get("rules")
    async listRules(@Param("id", pathParamPipe) taskId: string) {
        return this.listRulesForTask.execute({ taskId });
    }

    @Get("verdict-counts")
    async verdictCounts(@Param("id", pathParamPipe) taskId: string) {
        const counts = await this.getVerdictCounts.execute({ taskId });
        return { counts };
    }
}
