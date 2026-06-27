import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import { ZodValidationPipe } from "@monitor/contracts/http/zod-validation.pipe.js";
import { GetPreprocessingHintsUseCase } from "../application/get.preprocessing.hints.usecase.js";
import type { GetPreprocessingHintsUseCaseOut } from "../application/dto/preprocessing.hints.dto.js";
import { preprocessingHintsBodySchema, PreprocessingHintsDto } from "./preprocessing.hints.schema.js";

@Controller("api/v1/tasks")
export class PreprocessingHintsController {
    constructor(
        @Inject(GetPreprocessingHintsUseCase) private readonly getHints: GetPreprocessingHintsUseCase,
    ) {}

    @Post(":taskId/preprocessing-hints")
    @HttpCode(HttpStatus.OK)
    async preprocessingHints(
        @Param("taskId") taskId: string,
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
