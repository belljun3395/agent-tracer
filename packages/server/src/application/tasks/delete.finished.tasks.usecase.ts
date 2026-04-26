import type { INotificationPublisher, ITaskRepository } from "~application/ports/index.js";
import type { DeleteFinishedTasksUseCaseIn, DeleteFinishedTasksUseCaseOut } from "./dto/delete.finished.tasks.usecase.dto.js";

export class DeleteFinishedTasksUseCase {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(_input: DeleteFinishedTasksUseCaseIn): Promise<DeleteFinishedTasksUseCaseOut> {
        const count = await this.tasks.deleteFinished();
        this.notifier.publish({ type: "tasks.purged", payload: { count } });
        return { count };
    }
}
