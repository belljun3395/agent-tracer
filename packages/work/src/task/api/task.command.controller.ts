import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Patch,
    Post,
} from "@nestjs/common";
import { pathParamPipe } from "@monitor/contracts/http/path-param.pipe.js";
import { ZodValidationPipe } from "@monitor/contracts/http/zod-validation.pipe.js";
import { ArchiveTaskUseCase } from "../application/archive.task.usecase.js";
import { DeleteTaskUseCase } from "../application/delete.task.usecase.js";
import {
    MissingApiKeyError,
    SuggestTaskTitleUseCase,
} from "../application/suggest.task.title.usecase.js";
import { UnarchiveTaskUseCase } from "../application/unarchive.task.usecase.js";
import { UpdateTaskUseCase } from "../application/update.task.usecase.js";
import type { UpdateTaskUseCaseIn } from "../application/dto/update.task.usecase.dto.js";
import { TaskPatchDto, taskPatchSchema } from "./task.command.schema.js";

@Controller("api/v1/tasks")
export class TaskCommandController {
    constructor(
        private readonly updateTask: UpdateTaskUseCase,
        private readonly deleteTask: DeleteTaskUseCase,
        private readonly archiveTask: ArchiveTaskUseCase,
        private readonly unarchiveTask: UnarchiveTaskUseCase,
        private readonly suggestTitle: SuggestTaskTitleUseCase,
    ) {}

    @Patch(":taskId")
    async patchTask(
        @Param("taskId", pathParamPipe) taskId: string,
        @Body(new ZodValidationPipe(taskPatchSchema)) body: TaskPatchDto,
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
        await this.deleteTask.execute({ taskId });
        return { deleted: true };
    }

    @Post(":taskId/archive")
    @HttpCode(HttpStatus.OK)
    async archiveTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const result = await this.archiveTask.execute({ taskId });
        return {
            archived: true,
            archivedIds: result.archivedIds,
            archivedAt: result.archivedAt,
        };
    }

    @Delete(":taskId/archive")
    async unarchiveTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const result = await this.unarchiveTask.execute({ taskId });
        return { unarchived: true, unarchivedIds: result.unarchivedIds };
    }

    @Post(":taskId/suggest-title")
    @HttpCode(HttpStatus.OK)
    async suggestTitleEndpoint(
        @Param("taskId", pathParamPipe) taskId: string,
    ) {
        try {
            return await this.suggestTitle.execute({ taskId });
        } catch (err) {
            if (err instanceof MissingApiKeyError) {
                throw new BadRequestException(err.message);
            }
            throw err;
        }
    }
}
