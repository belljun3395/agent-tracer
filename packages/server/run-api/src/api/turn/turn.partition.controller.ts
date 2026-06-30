import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Put } from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { GetTurnPartitionUseCase } from "../../application/turn/get.turn.partition.usecase.js";
import { ResetTurnPartitionUseCase } from "../../application/turn/reset.turn.partition.usecase.js";
import { UpsertTurnPartitionUseCase } from "../../application/turn/upsert.turn.partition.usecase.js";
import {
    TurnPartitionUpsertDto,
    turnPartitionUpsertSchema,
} from "./turn.partition.command.schema.js";

@Controller("api/v1/tasks/:id/turn-partition")
export class TurnPartitionController {
    constructor(
        @Inject(GetTurnPartitionUseCase) private readonly getTurnPartition: GetTurnPartitionUseCase,
        @Inject(UpsertTurnPartitionUseCase) private readonly upsert: UpsertTurnPartitionUseCase,
        @Inject(ResetTurnPartitionUseCase) private readonly reset: ResetTurnPartitionUseCase,
    ) {}

    @Get()
    async get(@Param("id", pathParamPipe) taskId: string) {
        return this.getTurnPartition.execute({ taskId });
    }

    @Put()
    @HttpCode(HttpStatus.OK)
    async putPartition(
        @Param("id", pathParamPipe) taskId: string,
        @Body(new ZodValidationPipe(turnPartitionUpsertSchema)) body: TurnPartitionUpsertDto,
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
