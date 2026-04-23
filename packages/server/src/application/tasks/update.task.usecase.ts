import { createTaskSlug, type MonitoringTask } from "~domain/index.js";
import type { INotificationPublisher, ITaskRepository } from "~application/ports/index.js";
import type { TaskPatchInput } from "./task.lifecycle.input.js";

export class UpdateTaskUseCase {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: TaskPatchInput): Promise<MonitoringTask | null> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) return null;

        const titleUpdate = input.title !== undefined ? input.title.trim() : undefined;
        const hasNewTitle = titleUpdate !== undefined && titleUpdate !== task.title;
        const hasNewStatus = input.status !== undefined && input.status !== task.status;
        if (!hasNewTitle && !hasNewStatus) return task;

        const updated = await this.tasks.upsert({
            ...task,
            taskKind: task.taskKind ?? "primary",
            ...(hasNewTitle ? { title: titleUpdate, slug: createTaskSlug({ title: titleUpdate }) } : {}),
            ...(hasNewStatus ? { status: input.status } : {}),
            updatedAt: new Date().toISOString(),
        });
        this.notifier.publish({ type: "task.updated", payload: updated });
        return updated;
    }
}
