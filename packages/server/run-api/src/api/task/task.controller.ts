import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Patch,
    Post,
    Query,
} from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { ArchiveTaskUseCase } from "../../application/task/archive.task.usecase.js";
import { DeleteTaskUseCase } from "../../application/task/delete.task.usecase.js";
import { GetTaskLatestRuntimeSessionUseCase } from "../../application/task/get.task.latest.runtime.session.usecase.js";
import { GetTaskOpenInferenceUseCase } from "../../application/task/get.task.open.inference.usecase.js";
import { GetTaskTimelineUseCase } from "../../application/task/get.task.timeline.usecase.js";
import { GetTaskUseCase } from "../../application/task/get.task.usecase.js";
import { ListTasksUseCase } from "../../application/task/list.tasks.usecase.js";
import { SearchTasksUseCase } from "../../application/task/search.tasks.usecase.js";
import { SuggestTaskTitleUseCase } from "../../application/task/suggest.task.title.usecase.js";
import { UnarchiveTaskUseCase } from "../../application/task/unarchive.task.usecase.js";
import { UpdateTaskUseCase } from "../../application/task/update.task.usecase.js";
import type { UpdateTaskUseCaseIn } from "../../application/task/dto/update.task.usecase.dto.js";
import { TaskPatchDto, taskPatchSchema } from "./task.command.schema.js";
import {
    parseListTasksArchivedScope,
    parseListTasksOriginFilter,
} from "./task.query.filters.js";

@Controller("api/v1/tasks")
export class TaskController {
    constructor(
        private readonly listTasks: ListTasksUseCase,
        private readonly searchTasks: SearchTasksUseCase,
        private readonly getTask: GetTaskUseCase,
        private readonly getTaskTimeline: GetTaskTimelineUseCase,
        private readonly getTaskLatestRuntimeSession: GetTaskLatestRuntimeSessionUseCase,
        private readonly getTaskOpenInference: GetTaskOpenInferenceUseCase,
        private readonly updateTask: UpdateTaskUseCase,
        private readonly deleteTask: DeleteTaskUseCase,
        private readonly archiveTask: ArchiveTaskUseCase,
        private readonly unarchiveTask: UnarchiveTaskUseCase,
        private readonly suggestTitle: SuggestTaskTitleUseCase,
    ) {}

    @Get("search")
    async searchTasksEndpoint(
        @Query("query") queryParam?: string,
        @Query("limit") limitParam?: string,
    ) {
        const query = (queryParam ?? "").trim();
        if (!query) return { tasks: [] };
        const limit = limitParam ? Number(limitParam) : undefined;
        return this.searchTasks.execute({
            query,
            ...(limit !== undefined && Number.isFinite(limit) ? { limit } : {}),
        });
    }

    @Get()
    async listTasksEndpoint(
        @Query("archived") archivedParam?: string,
        @Query("origin") originParam?: string,
    ) {
        return this.listTasks.execute({
            archived: parseListTasksArchivedScope(archivedParam),
            origin: parseListTasksOriginFilter(originParam),
        });
    }

    @Get(":taskId/openinference")
    async taskOpenInference(@Param("taskId", pathParamPipe) taskId: string) {
        const exportPayload = await this.getTaskOpenInference.execute({ taskId });
        if (!exportPayload) throw new NotFoundException("Task not found");
        return exportPayload;
    }

    @Get(":taskId")
    async getTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const { task } = await this.getTask.execute({ taskId });
        if (!task) throw new NotFoundException("Task not found");
        const [timeline, runtimeSession] = await Promise.all([
            this.getTaskTimeline.execute({ taskId: task.id }),
            this.getTaskLatestRuntimeSession.execute({ taskId: task.id }),
        ]);
        return {
            task,
            timeline: timeline.timeline,
            ...(runtimeSession.runtimeSession ? {
                runtimeSessionId: runtimeSession.runtimeSession.runtimeSessionId,
                runtimeSource: runtimeSession.runtimeSession.runtimeSource,
            } : {}),
        };
    }

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
        return { archived: true, archivedIds: result.archivedIds, archivedAt: result.archivedAt };
    }

    @Delete(":taskId/archive")
    async unarchiveTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const result = await this.unarchiveTask.execute({ taskId });
        return { unarchived: true, unarchivedIds: result.unarchivedIds };
    }

    @Post(":taskId/suggest-title")
    @HttpCode(HttpStatus.OK)
    async suggestTitleEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        return this.suggestTitle.execute({ taskId });
    }
}
