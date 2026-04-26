import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    NotFoundException,
    Param,
    Post,
} from "@nestjs/common";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import {
    GenerateTurnSummaryUseCase,
    TurnNotFoundError,
} from "~application/verification/summary/index.js";
import {
    GenerateSummaryBodySchema,
    type GenerateSummaryBody,
} from "../schemas/turn.summary.schema.js";

@Controller("api/turns")
export class TurnSummaryController {
    constructor(
        @Inject(GenerateTurnSummaryUseCase)
        private readonly generateTurnSummary: GenerateTurnSummaryUseCase,
    ) {}

    @Post(":id/summary")
    @HttpCode(HttpStatus.OK)
    async generate(
        @Param("id", pathParamPipe) id: string,
        @Body(new ZodValidationPipe(GenerateSummaryBodySchema)) body: GenerateSummaryBody,
    ) {
        try {
            const result = await this.generateTurnSummary.execute({
                turnId: id,
                ...(body.force !== undefined ? { force: body.force } : {}),
            });
            return { ok: true, data: result };
        } catch (error) {
            if (error instanceof TurnNotFoundError) {
                throw new NotFoundException({
                    ok: false,
                    error: { code: error.code, message: "Turn not found" },
                });
            }
            throw error;
        }
    }

    @Get(":id/summary")
    async get(@Param("id", pathParamPipe) id: string) {
        const summaryMarkdown = await this.generateTurnSummary.getCachedSummary(id);
        if (!summaryMarkdown) {
            throw new NotFoundException({
                ok: false,
                error: { code: "NOT_GENERATED", message: "Summary not generated yet" },
            });
        }
        return { ok: true, data: { summaryMarkdown, cached: true } };
    }
}
