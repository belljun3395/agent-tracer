import { Controller, Get, Inject, Query } from "@nestjs/common";
import { VerdictCountsUseCase } from "~application/verification/query/index.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import {
    StatusLineQuerySchema,
    type StatusLineQuery,
} from "../schemas/statusline.schema.js";

@Controller("api/statusline")
export class StatusLineController {
    constructor(
        @Inject(VerdictCountsUseCase) private readonly countsUseCase: VerdictCountsUseCase,
    ) {}

    @Get("verdict-counts")
    async counts(
        @Query(new ZodValidationPipe(StatusLineQuerySchema)) query: StatusLineQuery,
    ) {
        const data = await this.countsUseCase.execute({
            ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        });
        return { ok: true, data };
    }
}
