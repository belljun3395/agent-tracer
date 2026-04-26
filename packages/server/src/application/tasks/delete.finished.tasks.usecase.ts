import type { NotificationPublisherPort } from "~application/ports/notifications/notification.publisher.port.js";
import type { TaskWritePort } from "~application/ports/tasks/task.write.port.js";
import type { DeleteFinishedTasksUseCaseIn, DeleteFinishedTasksUseCaseOut } from "./dto/delete.finished.tasks.usecase.dto.js";

export class DeleteFinishedTasksUseCase {
    constructor(
        private readonly tasks: TaskWritePort,
        private readonly notifier: NotificationPublisherPort,
    ) {}

    async execute(_input: DeleteFinishedTasksUseCaseIn): Promise<DeleteFinishedTasksUseCaseOut> {
        const count = await this.tasks.deleteFinished();
        this.notifier.publish({ type: "tasks.purged", payload: { count } });
        return { count };
    }
}
