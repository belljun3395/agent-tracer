import { Controller, Get, Headers, NotFoundException, Param } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { ListTaskUserInputsUseCase } from "~tracer-api/domain/task/application/query/list.task.user.inputs.usecase.js";
import { ListTurnsUseCase } from "~tracer-api/domain/task/application/query/list.turns.usecase.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";

/** 태스크 실행 대화와 규칙 근거 후보 조회 HTTP 계약을 제공한다. */
@Controller("api/v1/tasks")
export class TaskActivityController {
    constructor(
        private readonly listTurns: ListTurnsUseCase,
        private readonly listTaskUserInputs: ListTaskUserInputsUseCase,
    ) {}

    @Get(":taskId/turns")
    async turns(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
    ) {
        const result = await this.listTurns.execute(resolveUserId(user), taskId);
        if (result === null) throw new NotFoundException("Task not found");
        return result;
    }

    @Get(":taskId/user-inputs")
    async userInputs(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
    ) {
        return this.listTaskUserInputs.execute(resolveUserId(user), taskId);
    }
}
