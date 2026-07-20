import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TitleRank } from "@monitor/kernel";
import { CLOCK, type ClockPort } from "~tracer-api/domain/task/port/clock.port.js";
import { TASK_REPOSITORY, type TaskRepositoryPort } from "~tracer-api/domain/task/port/task.repository.port.js";
import { TASK_SEARCH_INDEX, type TaskSearchIndexPort } from "~tracer-api/domain/task/port/task.search.index.port.js";

@Injectable()
export class RenameTaskUseCase {
    constructor(
        @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepositoryPort,
        @Inject(TASK_SEARCH_INDEX) private readonly search: TaskSearchIndexPort,
        @Inject(CLOCK) private readonly clock: ClockPort,
    ) {}

    async execute(taskId: string, title: string, rank: TitleRank): Promise<{ readonly taskId: string; readonly title: string }> {
        const task = await this.tasks.findById(taskId);
        if (task === null) throw new NotFoundException("Task not found");
        if (task.applyRankedTitle(title, rank, this.clock.now())) {
            await this.tasks.upsert(task);
            await this.search.partialUpdate(taskId, { title: task.title });
        }
        return { taskId, title: task.title };
    }
}
