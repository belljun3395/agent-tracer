import {
    Controller,
    Get,
    Inject,
    NotFoundException,
    Param,
    Query,
} from "@nestjs/common";
import {
    GetTurnReceiptUseCase,
    ListTurnsUseCase,
} from "~application/verification/query/index.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import {
    ListTurnsQuerySchema,
    type ListTurnsQuery,
} from "../schemas/turns.schema.js";

@Controller("api/turns")
export class TurnsQueryController {
    constructor(
        @Inject(ListTurnsUseCase) private readonly listTurns: ListTurnsUseCase,
        @Inject(GetTurnReceiptUseCase) private readonly getTurnReceipt: GetTurnReceiptUseCase,
    ) {}

    @Get()
    async list(
        @Query(new ZodValidationPipe(ListTurnsQuerySchema)) query: ListTurnsQuery,
    ) {
        const result = await this.listTurns.execute({
            limit: query.limit,
            ...(query.sessionId ? { sessionId: query.sessionId } : {}),
            ...(query.taskId ? { taskId: query.taskId } : {}),
            ...(query.verdict ? { verdict: query.verdict } : {}),
            ...(query.cursor ? { cursor: query.cursor } : {}),
        });
        return { ok: true, data: result };
    }

    @Get(":id")
    async getOne(@Param("id", pathParamPipe) id: string) {
        const receipt = await this.getTurnReceipt.execute(id);
        if (!receipt) {
            throw new NotFoundException({
                code: "not_found",
                message: "turn not found",
            });
        }
        return { ok: true, data: { receipt } };
    }
}
