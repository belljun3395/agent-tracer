import type { INotificationPublisher, ITaskRepository } from "~application/ports/index.js";

export class DeleteTaskUseCase {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(taskId: string): Promise<"deleted" | "not_found"> {
        if (!(await this.tasks.findById(taskId))) return "not_found";
        const result = await this.tasks.delete(taskId);
        for (const id of result.deletedIds) {
            this.notifier.publish({ type: "task.deleted", payload: { taskId: id } });
        }
        return "deleted";
    }
}
