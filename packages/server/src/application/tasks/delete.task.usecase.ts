import type { INotificationPublisher, ITaskRepository } from "~application/ports/index.js";
import type { DeleteTaskUseCaseIn, DeleteTaskUseCaseOut } from "./dto/delete.task.usecase.dto.js";

export class DeleteTaskUseCase {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly notifier: INotificationPublisher,
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
