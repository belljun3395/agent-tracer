import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { GetPreprocessingHintsUseCase } from "@monitor/timeline-api/application/event/get.preprocessing.hints.usecase.js";
import type { GetPreprocessingHintsUseCaseOut } from "@monitor/timeline-api/application/event/dto/preprocessing.hints.dto.js";
import { preprocessingHintsBodySchema, PreprocessingHintsDto } from "@monitor/timeline-api/api/event/preprocessing.hints.schema.js";

@Controller("api/v1/events")
export class PreprocessingHintsController {
    constructor(
        @Inject(GetPreprocessingHintsUseCase) private readonly getHints: GetPreprocessingHintsUseCase,
    ) {}

    @Post("preprocessing-hints")
    @HttpCode(HttpStatus.OK)
    async preprocessingHints(
        @Query("taskId", pathParamPipe) taskId: string,
        @Body(new ZodValidationPipe(preprocessingHintsBodySchema)) body: PreprocessingHintsDto,
    ): Promise<GetPreprocessingHintsUseCaseOut> {
        return this.getHints.execute({
            taskId,
            trigger: body.trigger,
            ...(body.toolName ? { toolName: body.toolName } : {}),
            ...(body.command ? { command: body.command } : {}),
            ...(body.questions ? { questions: body.questions } : {}),
        });
    }
}
