import type { NotificationPublisherPort } from "~application/ports/notifications/notification.publisher.port.js";
import type { TaskReadPort } from "~application/ports/tasks/task.read.port.js";
import type { TaskWritePort } from "~application/ports/tasks/task.write.port.js";
import type { DeleteTaskUseCaseIn, DeleteTaskUseCaseOut } from "./dto/delete.task.usecase.dto.js";

export class DeleteTaskUseCase {
    constructor(
        private readonly tasks: TaskReadPort & TaskWritePort,
        private readonly notifier: NotificationPublisherPort,
    ) {}

    async execute(input: DeleteTaskUseCaseIn): Promise<DeleteTaskUseCaseOut> {
        const { taskId } = input;
        if (!(await this.tasks.findById(taskId))) return { status: "not_found" };
        const result = await this.tasks.delete(taskId);
        for (const id of result.deletedIds) {
            this.notifier.publish({ type: "task.deleted", payload: { taskId: id } });
        }
        return { status: "deleted" };
    }
}
