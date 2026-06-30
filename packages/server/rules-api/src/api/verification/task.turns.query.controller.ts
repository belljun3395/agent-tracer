import { Controller, Get, Param } from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { GetTaskTurnsUseCase } from "../../application/verification/get.task.turns.usecase.js";

@Controller("api/v1/tasks")
export class TaskTurnsQueryController {
    constructor(private readonly getTaskTurns: GetTaskTurnsUseCase) {}

    @Get(":taskId/turns")
    async getTaskTurnsEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        return this.getTaskTurns.execute({ taskId });
    }
}
