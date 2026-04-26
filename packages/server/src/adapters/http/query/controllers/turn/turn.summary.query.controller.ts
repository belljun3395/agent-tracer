import {
    Controller,
    Get,
    Inject,
    NotFoundException,
    Param,
} from "@nestjs/common";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import {
    GenerateTurnSummaryUseCase,
} from "~application/verification/summary/index.js";

@Controller("api/v1/turns")
export class TurnSummaryQueryController {
    constructor(
        @Inject(GenerateTurnSummaryUseCase)
        private readonly generateTurnSummary: GenerateTurnSummaryUseCase,
    ) {}

    // fetches cached summary markdown if already generated
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
