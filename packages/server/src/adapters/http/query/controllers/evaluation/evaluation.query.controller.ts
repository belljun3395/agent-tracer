import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { GetTaskEvaluationUseCase } from "~application/workflow/index.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";

@Controller("api/v1/tasks/:id")
export class TaskEvaluationController {
    constructor(
        @Inject(GetTaskEvaluationUseCase) private readonly getTaskEvaluation: GetTaskEvaluationUseCase,
    ) {}

    // fetches the saved rating/evaluation for the task detail panel
    @Get("evaluate")
    async getEvaluation(
        @Param("id", pathParamPipe) taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
    ) {
        const evaluation = await this.getTaskEvaluation.execute(taskId, scopeKey);
        return evaluation ?? null;
    }
}
