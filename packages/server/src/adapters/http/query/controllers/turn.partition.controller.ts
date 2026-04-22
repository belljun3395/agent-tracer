import { Controller, Get, Inject, Param } from "@nestjs/common";
import { GetTurnPartitionUseCase } from "~application/workflow/usecases.index.js";

@Controller()
export class TurnPartitionController {
    constructor(
        @Inject(GetTurnPartitionUseCase) private readonly getTurnPartition: GetTurnPartitionUseCase,
    ) {}

    @Get("/api/tasks/:id/turn-partition")
    async get(@Param("id") taskId: string) {
        return this.getTurnPartition.execute(taskId);
    }
}
