import type { ITaskRepository } from "../ports/index.js";
import type { ListTasksUseCaseIn, ListTasksUseCaseOut } from "./dto/list.tasks.usecase.dto.js";

export class ListTasksUseCase {
    constructor(private readonly taskRepo: ITaskRepository) {}
    async execute(_input: ListTasksUseCaseIn): Promise<ListTasksUseCaseOut> {
        return { tasks: await this.taskRepo.findAll() };
    }
}
