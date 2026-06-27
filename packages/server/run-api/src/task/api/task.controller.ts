import {
    BadRequestException,
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
import { ArchiveTaskUseCase } from "../application/archive.task.usecase.js";
import { DeleteTaskUseCase } from "../application/delete.task.usecase.js";
import { GetTaskLatestRuntimeSessionUseCase } from "../application/get.task.latest.runtime.session.usecase.js";
import { GetTaskOpenInferenceUseCase } from "../application/get.task.open.inference.usecase.js";
import { GetTaskTimelineUseCase } from "../application/get.task.timeline.usecase.js";
import { GetTaskTurnsUseCase } from "../application/get.task.turns.usecase.js";
import { GetTaskUseCase } from "../application/get.task.usecase.js";
import { ListTasksUseCase } from "../application/list.tasks.usecase.js";
import { SearchTasksUseCase } from "../application/search.tasks.usecase.js";
import {
    MissingApiKeyError,
    SuggestTaskTitleUseCase,
} from "../application/suggest.task.title.usecase.js";
import { UnarchiveTaskUseCase } from "../application/unarchive.task.usecase.js";
import { UpdateTaskUseCase } from "../application/update.task.usecase.js";
import type { UpdateTaskUseCaseIn } from "../application/dto/update.task.usecase.dto.js";
import type {
    ListTasksArchivedScope,
    ListTasksOriginFilter,
} from "../application/dto/list.tasks.usecase.dto.js";
import { TaskPatchDto, taskPatchSchema } from "./task.command.schema.js";

const ARCHIVED_SCOPES: ReadonlySet<ListTasksArchivedScope> = new Set(["active", "archived", "all"]);
const ORIGIN_FILTERS: ReadonlySet<ListTasksOriginFilter> = new Set(["user", "server-sdk", "all"]);

// Single task controller (command + query) under api/v1/tasks. Static routes
// (search) are declared before the :taskId param routes so they aren't captured.
@Controller("api/v1/tasks")
export class TaskController {
    constructor(
        private readonly listTasks: ListTasksUseCase,
        private readonly searchTasks: SearchTasksUseCase,
        private readonly getTask: GetTaskUseCase,
        private readonly getTaskTimeline: GetTaskTimelineUseCase,
        private readonly getTaskTurns: GetTaskTurnsUseCase,
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
        const scope = archivedParam ?? "active";
        if (!ARCHIVED_SCOPES.has(scope as ListTasksArchivedScope)) {
            throw new BadRequestException(`archived must be one of: active, archived, all`);
        }
        const origin = originParam ?? "all";
        if (!ORIGIN_FILTERS.has(origin as ListTasksOriginFilter)) {
            throw new BadRequestException(`origin must be one of: user, server-sdk, all`);
        }
        return this.listTasks.execute({
            archived: scope as ListTasksArchivedScope,
            origin: origin as ListTasksOriginFilter,
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
        const [timeline, turns, runtimeSession] = await Promise.all([
            this.getTaskTimeline.execute({ taskId: task.id }),
            this.getTaskTurns.execute({ taskId: task.id }),
            this.getTaskLatestRuntimeSession.execute({ taskId: task.id }),
        ]);
        return {
            task,
            timeline: timeline.timeline,
            turns: turns.turns,
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
        try {
            return await this.suggestTitle.execute({ taskId });
        } catch (err) {
            if (err instanceof MissingApiKeyError) throw new BadRequestException(err.message);
            throw err;
        }
    }
}
