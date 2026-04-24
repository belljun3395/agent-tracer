import { Body, Controller, HttpCode, HttpException, HttpStatus, Inject, Param, Post, Put } from "@nestjs/common";
import {
    ResetTurnPartitionUseCase,
    UpsertTurnPartitionUseCase,
} from "~application/workflow/usecases.index.js";
import { turnPartitionUpsertSchema, type TurnPartitionUpsertBody } from "../schemas/turn.partition.write.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/tasks/:id/turn-partition")
export class TurnPartitionWriteController {
    constructor(
        @Inject(UpsertTurnPartitionUseCase) private readonly upsert: UpsertTurnPartitionUseCase,
        @Inject(ResetTurnPartitionUseCase) private readonly reset: ResetTurnPartitionUseCase,
    ) {}

    @Put()
    @HttpCode(HttpStatus.OK)
    async putPartition(
        @Param("id", pathParamPipe) taskId: string,
        @Body(new ZodValidationPipe(turnPartitionUpsertSchema)) body: TurnPartitionUpsertBody,
    ) {
        try {
            return await this.upsert.execute(taskId, {
                groups: body.groups.map((g) => ({
                    id: g.id,
                    from: g.from,
                    to: g.to,
                    label: g.label ?? null,
                    visible: g.visible,
                })),
                ...(body.baseVersion !== undefined ? { baseVersion: body.baseVersion } : {}),
            });
        } catch (error) {
            throw toHttpError(error);
        }
    }

    @Post("reset")
    @HttpCode(HttpStatus.OK)
    async resetPartition(@Param("id", pathParamPipe) taskId: string) {
        try {
            await this.reset.execute(taskId);
            return { ok: true };
        } catch (error) {
            throw toHttpError(error);
        }
    }
}

function toHttpError(error: unknown): HttpException {
    const message = error instanceof Error ? error.message : String(error);
    if (/not found/i.test(message)) {
        return new HttpException({ error: message }, HttpStatus.NOT_FOUND);
    }
    if (/version mismatch/i.test(message)) {
        return new HttpException({ error: message }, HttpStatus.CONFLICT);
    }
    return new HttpException({ error: message }, HttpStatus.BAD_REQUEST);
}
