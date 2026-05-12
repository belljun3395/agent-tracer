import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Patch,
    Post,
} from "@nestjs/common";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import { ArchiveTaskUseCase } from "../application/archive.task.usecase.js";
import { DeleteTaskUseCase } from "../application/delete.task.usecase.js";
import { UnarchiveTaskUseCase } from "../application/unarchive.task.usecase.js";
import { UpdateTaskUseCase } from "../application/update.task.usecase.js";
import type { UpdateTaskUseCaseIn } from "../application/dto/update.task.usecase.dto.js";
import { taskPatchSchema } from "./task.command.schema.js";

@Controller("api/v1/tasks")
export class TaskCommandController {
    constructor(
        private readonly updateTask: UpdateTaskUseCase,
        private readonly deleteTask: DeleteTaskUseCase,
        private readonly archiveTask: ArchiveTaskUseCase,
        private readonly unarchiveTask: UnarchiveTaskUseCase,
    ) {}

    @Patch(":taskId")
    async patchTask(
        @Param("taskId", pathParamPipe) taskId: string,
        @Body(new ZodValidationPipe(taskPatchSchema)) body: Omit<UpdateTaskUseCaseIn, "taskId">,
    ) {
        const patchInput: UpdateTaskUseCaseIn = {
            taskId,
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
        };
        const task = await this.updateTask.execute(patchInput);
        if (!task) throw new NotFoundException("Task not found");
        return { task };
    }

    @Delete(":taskId")
    async deleteTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const result = await this.deleteTask.execute({ taskId });
        if (result.status === "not_found") throw new NotFoundException("Task not found");
        return { deleted: true };
    }

    @Post(":taskId/archive")
    @HttpCode(HttpStatus.OK)
    async archiveTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const result = await this.archiveTask.execute({ taskId });
        if (result.status === "not_found") throw new NotFoundException("Task not found");
        if (result.status === "already_archived") {
            throw new ConflictException("Task is already archived");
        }
        return {
            archived: true,
            archivedIds: result.archivedIds,
            archivedAt: result.archivedAt,
        };
    }

    @Delete(":taskId/archive")
    async unarchiveTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const result = await this.unarchiveTask.execute({ taskId });
        if (result.status === "not_found") throw new NotFoundException("Task not found");
        if (result.status === "not_archived") {
            throw new BadRequestException("Task is not archived");
        }
        return { unarchived: true, unarchivedIds: result.unarchivedIds };
    }
}
