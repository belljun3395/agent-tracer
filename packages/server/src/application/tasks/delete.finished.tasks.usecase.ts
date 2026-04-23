import type { INotificationPublisher, ITaskRepository } from "~application/ports/index.js";

export class DeleteFinishedTasksUseCase {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(): Promise<number> {
        const count = await this.tasks.deleteFinished();
        this.notifier.publish({ type: "tasks.purged", payload: { count } });
        return count;
    }
}
