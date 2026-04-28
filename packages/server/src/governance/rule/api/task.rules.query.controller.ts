import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ListRulesForTaskUseCase } from "../application/list.rules.usecase.js";
import { VERDICT_COUNT_QUERY_PORT } from "../application/outbound/tokens.js";
import type { IVerdictCountQuery } from "../application/outbound/verdict.count.query.port.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";

@Controller("api/v1/tasks/:id")
export class TaskRulesQueryController {
    constructor(
        @Inject(ListRulesForTaskUseCase) private readonly listRulesForTask: ListRulesForTaskUseCase,
        @Inject(VERDICT_COUNT_QUERY_PORT) private readonly verdictCounts: IVerdictCountQuery,
    ) {}

    @Get("rules")
    async listRules(@Param("id", pathParamPipe) taskId: string) {
        return this.listRulesForTask.execute({ taskId });
    }

    @Get("verdict-counts")
    async verdictCountsForTask(@Param("id", pathParamPipe) taskId: string) {
        const counts = await this.verdictCounts.countForTask(taskId);
        return { counts };
    }
}
