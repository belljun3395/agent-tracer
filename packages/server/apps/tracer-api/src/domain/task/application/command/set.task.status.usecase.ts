import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TaskStatus } from "@monitor/kernel";
import { CLOCK, type ClockPort } from "~tracer-api/domain/task/port/clock.port.js";
import { TASK_REPOSITORY, type TaskRepositoryPort } from "~tracer-api/domain/task/port/task.repository.port.js";

@Injectable()
export class SetTaskStatusUseCase {
    constructor(
        @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepositoryPort,
        @Inject(CLOCK) private readonly clock: ClockPort,
    ) {}

    async execute(taskId: string, status: TaskStatus): Promise<{ readonly taskId: string; readonly status: TaskStatus }> {
        const task = await this.tasks.findById(taskId);
        if (task === null) throw new NotFoundException("Task not found");
        task.forceStatus(status, this.clock.now());
        await this.tasks.upsert(task);
        return { taskId, status };
    }
}
