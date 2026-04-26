import { createTaskSlug } from "~domain/index.js";
import type { INotificationPublisher, ITaskRepository } from "~application/ports/index.js";
import type { LinkTaskUseCaseIn, LinkTaskUseCaseOut } from "./dto/link.task.usecase.dto.js";
import { TaskNotFoundError } from "./common/task.errors.js";

export class LinkTaskUseCase {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: LinkTaskUseCaseIn): Promise<LinkTaskUseCaseOut> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);
        const t = input.title?.trim();
        const updated = await this.tasks.upsert({
            ...task,
            taskKind: input.taskKind ?? task.taskKind ?? "primary",
            ...(t ? { title: t, slug: createTaskSlug({ title: t }) } : {}),
            ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
            ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
            ...(input.backgroundTaskId ? { backgroundTaskId: input.backgroundTaskId } : {}),
            updatedAt: new Date().toISOString(),
        });
        this.notifier.publish({ type: "task.updated", payload: updated });
        return updated;
    }
}
