import {
    Body,
    Controller,
    Delete,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
} from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { ArchiveTaskUseCase } from "~tracer-api/domain/task/application/command/archive.task.usecase.js";
import { HideTaskUseCase } from "~tracer-api/domain/task/application/command/hide.task.usecase.js";
import { RenameTaskUseCase } from "~tracer-api/domain/task/application/command/rename.task.usecase.js";
import { SetTaskStatusUseCase } from "~tracer-api/domain/task/application/command/set.task.status.usecase.js";
import { UnarchiveTaskUseCase } from "~tracer-api/domain/task/application/command/unarchive.task.usecase.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { updateBodySchema, type UpdateBody } from "./task.command.schema.js";

/** 태스크 수정·보관·숨김 HTTP 계약을 제공한다. */
@Controller("api/v1/tasks")
export class TaskCommandController {
    constructor(
        private readonly renameTask: RenameTaskUseCase,
        private readonly setTaskStatus: SetTaskStatusUseCase,
        private readonly archiveTask: ArchiveTaskUseCase,
        private readonly unarchiveTask: UnarchiveTaskUseCase,
        private readonly hideTask: HideTaskUseCase,
    ) {}

    @Patch(":taskId")
    async update(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
        @Body(new SchemaValidationPipe(updateBodySchema)) body: UpdateBody,
    ) {
        const results: Record<string, unknown> = { taskId };
        if (body.title !== undefined) {
            Object.assign(results, await this.renameTask.execute(resolveUserId(user), taskId, body.title));
        }
        if (body.status !== undefined) {
            Object.assign(results, await this.setTaskStatus.execute(taskId, body.status));
        }
        return results;
    }

    @Post(":taskId/archive")
    @HttpCode(HttpStatus.OK)
    async archive(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
    ) {
        return this.archiveTask.execute(resolveUserId(user), taskId);
    }

    @Delete(":taskId/archive")
    @HttpCode(HttpStatus.OK)
    async unarchive(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
    ) {
        return this.unarchiveTask.execute(resolveUserId(user), taskId);
    }

    @Delete(":taskId")
    @HttpCode(HttpStatus.OK)
    async hide(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
    ) {
        return this.hideTask.execute(resolveUserId(user), taskId);
    }
}
