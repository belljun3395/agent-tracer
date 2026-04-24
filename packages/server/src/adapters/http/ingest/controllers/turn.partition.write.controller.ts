import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post, Put } from "@nestjs/common";
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
        return this.upsert.execute(taskId, {
            groups: body.groups.map((g) => ({
                id: g.id,
                from: g.from,
                to: g.to,
                label: g.label ?? null,
                visible: g.visible,
            })),
            ...(body.baseVersion !== undefined ? { baseVersion: body.baseVersion } : {}),
        });
    }

    @Post("reset")
    @HttpCode(HttpStatus.OK)
    async resetPartition(@Param("id", pathParamPipe) taskId: string) {
        await this.reset.execute(taskId);
        return { reset: true };
    }
}
