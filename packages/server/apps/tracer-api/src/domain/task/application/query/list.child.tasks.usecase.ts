import { Inject, Injectable } from "@nestjs/common";
import { TaskView, type TaskListItemDto } from "@monitor/tracer-domain";
import { TASK_REPOSITORY, type TaskRepositoryPort } from "~tracer-api/domain/task/port/task.repository.port.js";
import {
    TASK_USER_STATE_REPOSITORY,
    type TaskUserStateRepositoryPort,
} from "~tracer-api/domain/task/port/task.user.state.repository.port.js";

@Injectable()
export class ListChildTasksUseCase {
    constructor(
        @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepositoryPort,
        @Inject(TASK_USER_STATE_REPOSITORY) private readonly states: TaskUserStateRepositoryPort,
    ) {}

    async execute(userId: string, taskId: string): Promise<{ readonly items: readonly TaskListItemDto[] } | null> {
        const parent = await this.tasks.findById(taskId);
        // 남의 작업은 존재 여부도 드러내지 않는다.
        if (parent === null || !parent.isOwnedBy(userId)) return null;
        const children = await this.tasks.findChildren(taskId);
        const items: TaskListItemDto[] = [];
        for (const child of children) {
            const state = await this.states.findById(child.id);
            const view = new TaskView(child, state);
            if (!view.isVisible()) continue;
            items.push(view.toListItem());
        }
        return { items };
    }
}
