import { Body, Controller, Delete, Inject, NotFoundException, Param, Patch } from "@nestjs/common";
import {
    UpdateTaskUseCase,
    DeleteTaskUseCase,
    DeleteFinishedTasksUseCase,
} from "~application/tasks/index.js";
import type { TaskPatchInput } from "~application/tasks/index.js";
import {
    taskPatchSchema,
} from "~adapters/http/ingest/schemas/task.write.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/tasks")
export class TaskCommandController {
    constructor(
        @Inject(UpdateTaskUseCase) private readonly updateTask: UpdateTaskUseCase,
        @Inject(DeleteTaskUseCase) private readonly deleteTask: DeleteTaskUseCase,
        @Inject(DeleteFinishedTasksUseCase) private readonly deleteFinishedTasks: DeleteFinishedTasksUseCase,
    ) {}

    // updates task title or status from the UI
    @Patch(":taskId")
    async patchTask(
        @Param("taskId", pathParamPipe) taskId: string,
        @Body(new ZodValidationPipe(taskPatchSchema)) body: Omit<TaskPatchInput, "taskId">,
    ) {
        const patchInput: TaskPatchInput = {
            taskId,
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
        };
        const task = await this.updateTask.execute(patchInput);
        if (!task) throw new NotFoundException("Task not found");
        return { task };
    }

    // bulk-removes all completed tasks from the UI
    @Delete("finished")
    async deleteFinished() {
        const deleted = await this.deleteFinishedTasks.execute();
        return { deleted };
    }

    // deletes a single task from the UI
    @Delete(":taskId")
    async deleteTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const result = await this.deleteTask.execute(taskId);
        if (result === "not_found") throw new NotFoundException("Task not found");
        return { deleted: true };
    }
}
