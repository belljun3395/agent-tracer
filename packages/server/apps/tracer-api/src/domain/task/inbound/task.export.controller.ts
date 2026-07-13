import { Controller, Get, Headers, NotFoundException, Param } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { ExportOpenInferenceUseCase } from "~tracer-api/domain/task/application/export/export.openinference.usecase.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";

/** 태스크의 외부 관측 포맷 내보내기 HTTP 계약을 제공한다. */
@Controller("api/v1/tasks")
export class TaskExportController {
    constructor(private readonly exportOpenInference: ExportOpenInferenceUseCase) {}

    @Get(":taskId/openinference")
    async openinference(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
    ) {
        const result = await this.exportOpenInference.execute(resolveUserId(user), taskId);
        if (result === null) throw new NotFoundException("Task not found");
        return result;
    }
}
