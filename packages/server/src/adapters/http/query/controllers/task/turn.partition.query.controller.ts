import { Controller, Get, Inject, Param } from "@nestjs/common";
import { GetTurnPartitionUseCase } from "~application/workflow/index.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";

@Controller("api/v1/tasks/:id/turn/partition")
export class TurnPartitionQueryController {
    constructor(@Inject(GetTurnPartitionUseCase) private readonly getTurnPartition: GetTurnPartitionUseCase) {}

    // loads turn grouping config for the turn partition editor
    @Get()
    async get(@Param("id", pathParamPipe) taskId: string) {
        return this.getTurnPartition.execute(taskId);
    }
}
