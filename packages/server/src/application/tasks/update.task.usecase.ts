import { createTaskSlug } from "~domain/monitoring/task/task.js";
import type { NotificationPublisherPort } from "~application/ports/notifications/notification.publisher.port.js";
import type { TaskReadPort } from "~application/ports/tasks/task.read.port.js";
import type { TaskWritePort } from "~application/ports/tasks/task.write.port.js";
import type { UpdateTaskUseCaseIn, UpdateTaskUseCaseOut } from "./dto/update.task.usecase.dto.js";

export class UpdateTaskUseCase {
    constructor(
        private readonly tasks: TaskReadPort & TaskWritePort,
        private readonly notifier: NotificationPublisherPort,
    ) {}

    async execute(input: UpdateTaskUseCaseIn): Promise<UpdateTaskUseCaseOut> {
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
