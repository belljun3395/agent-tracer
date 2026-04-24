import { Controller, Get, Inject, Param } from "@nestjs/common";
import { GetTurnPartitionUseCase } from "~application/workflow/usecases.index.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";

@Controller("api/tasks/:id/turn-partition")
export class TurnPartitionController {
    constructor(
        @Inject(GetTurnPartitionUseCase) private readonly getTurnPartition: GetTurnPartitionUseCase,
    ) {}

    @Get()
    async get(@Param("id", pathParamPipe) taskId: string) {
        return this.getTurnPartition.execute(taskId);
    }
}
