import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post, Query } from "@nestjs/common";
import { UpsertTaskEvaluationUseCase } from "~application/workflow/index.js";
import { taskEvaluateSchema } from "~adapters/http/ingest/schemas/evaluation.write.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("ingest/v1/tasks/:id")
export class EvaluationIngestController {
    constructor(
        @Inject(UpsertTaskEvaluationUseCase) private readonly upsertTaskEvaluation: UpsertTaskEvaluationUseCase,
    ) {}

    // mcp uses it from the monitor_evaluate_task tool
    @Post("evaluate")
    @HttpCode(HttpStatus.OK)
    async upsertEvaluation(
        @Param("id", pathParamPipe) taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
        @Body(new ZodValidationPipe(taskEvaluateSchema)) body: Parameters<UpsertTaskEvaluationUseCase["execute"]>[1],
    ) {
        const { rating, useCase, workflowTags, outcomeNote, approachNote, reuseWhen, watchouts, workflowSnapshot, workflowContext } = body;
        await this.upsertTaskEvaluation.execute(taskId, {
            ...(scopeKey ? { scopeKey } : {}),
            rating,
            ...(useCase !== undefined ? { useCase } : {}),
            ...(workflowTags !== undefined ? { workflowTags } : {}),
            ...(outcomeNote !== undefined ? { outcomeNote } : {}),
            ...(approachNote !== undefined ? { approachNote } : {}),
            ...(reuseWhen !== undefined ? { reuseWhen } : {}),
            ...(watchouts !== undefined ? { watchouts } : {}),
            ...(workflowSnapshot !== undefined ? { workflowSnapshot } : {}),
            ...(workflowContext !== undefined ? { workflowContext } : {}),
        });
        return { evaluated: true };
    }
}
