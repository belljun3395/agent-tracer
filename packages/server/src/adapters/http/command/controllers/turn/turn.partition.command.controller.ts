import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post, Put } from "@nestjs/common";
import {
    ResetTurnPartitionUseCase,
    UpsertTurnPartitionUseCase,
} from "~application/turn-partitions/index.js";
import {
    turnPartitionUpsertSchema,
    type TurnPartitionUpsertBody,
} from "~adapters/http/command/schemas/turn-partition.command.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/tasks/:id/turn-partition")
export class TurnPartitionCommandController {
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
        return this.upsert.execute({
            taskId,
            groups: body.groups.map((group) => ({
                id: group.id,
                from: group.from,
                to: group.to,
                label: group.label ?? null,
                visible: group.visible,
            })),
            ...(body.baseVersion !== undefined ? { baseVersion: body.baseVersion } : {}),
        });
    }

    @Post("reset")
    @HttpCode(HttpStatus.OK)
    async resetPartition(@Param("id", pathParamPipe) taskId: string) {
        await this.reset.execute({ taskId });
        return { reset: true };
    }
}
