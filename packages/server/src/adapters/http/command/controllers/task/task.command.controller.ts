import { Body, Controller, Delete, Inject, NotFoundException, Param, Patch } from "@nestjs/common";
import { DeleteFinishedTasksUseCase } from "~application/tasks/delete.finished.tasks.usecase.js";
import { DeleteTaskUseCase } from "~application/tasks/delete.task.usecase.js";
import { UpdateTaskUseCase } from "~application/tasks/update.task.usecase.js";
import type { UpdateTaskUseCaseIn } from "~application/tasks/dto/update.task.usecase.dto.js";
import { taskPatchSchema } from "~adapters/http/command/schemas/task.command.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/tasks")
export class TaskCommandController {
    constructor(
        @Inject(UpdateTaskUseCase) private readonly updateTask: UpdateTaskUseCase,
        @Inject(DeleteTaskUseCase) private readonly deleteTask: DeleteTaskUseCase,
        @Inject(DeleteFinishedTasksUseCase) private readonly deleteFinishedTasks: DeleteFinishedTasksUseCase,
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

    @Delete("finished")
    async deleteFinished() {
        const { count } = await this.deleteFinishedTasks.execute({});
        return { deleted: count };
    }

    @Delete(":taskId")
    async deleteTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const result = await this.deleteTask.execute({ taskId });
        if (result.status === "not_found") throw new NotFoundException("Task not found");
        return { deleted: true };
    }
}
