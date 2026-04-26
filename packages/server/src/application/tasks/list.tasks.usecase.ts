import type { TaskReadPort } from "~application/ports/tasks/task.read.port.js";
import type { ListTasksUseCaseIn, ListTasksUseCaseOut } from "./dto/list.tasks.usecase.dto.js";

export class ListTasksUseCase {
    constructor(private readonly taskRepo: TaskReadPort) {}
    async execute(_input: ListTasksUseCaseIn): Promise<ListTasksUseCaseOut> {
        return { tasks: await this.taskRepo.findAll() };
    }
}
