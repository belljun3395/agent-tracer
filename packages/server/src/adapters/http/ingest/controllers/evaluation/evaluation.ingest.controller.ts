import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post, Query } from "@nestjs/common";
import {
    UpsertTaskEvaluationUseCase,
    type UpsertTaskEvaluationUseCaseIn,
} from "~application/workflow/index.js";
import { taskEvaluateSchema } from "~adapters/http/shared/schemas/task-evaluation.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("ingest/v1/tasks/:id")
export class EvaluationIngestController {
    constructor(
        @Inject(UpsertTaskEvaluationUseCase) private readonly upsertTaskEvaluation: UpsertTaskEvaluationUseCase,
    ) {}

    @Post("evaluate")
    @HttpCode(HttpStatus.OK)
    async upsertEvaluation(
        @Param("id", pathParamPipe) taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
        @Body(new ZodValidationPipe(taskEvaluateSchema)) body: Omit<UpsertTaskEvaluationUseCaseIn, "taskId" | "scopeKey">,
    ) {
        await this.upsertTaskEvaluation.execute({
            taskId,
            ...(scopeKey ? { scopeKey } : {}),
            rating: body.rating,
            ...(body.useCase !== undefined ? { useCase: body.useCase } : {}),
            ...(body.workflowTags !== undefined ? { workflowTags: body.workflowTags } : {}),
            ...(body.outcomeNote !== undefined ? { outcomeNote: body.outcomeNote } : {}),
            ...(body.approachNote !== undefined ? { approachNote: body.approachNote } : {}),
            ...(body.reuseWhen !== undefined ? { reuseWhen: body.reuseWhen } : {}),
            ...(body.watchouts !== undefined ? { watchouts: body.watchouts } : {}),
            ...(body.workflowSnapshot !== undefined ? { workflowSnapshot: body.workflowSnapshot } : {}),
            ...(body.workflowContext !== undefined ? { workflowContext: body.workflowContext } : {}),
        });
        return { evaluated: true };
    }
}
