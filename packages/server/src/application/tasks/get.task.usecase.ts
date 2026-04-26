import type { ITaskRepository } from "../ports/index.js";
import type { GetTaskUseCaseIn, GetTaskUseCaseOut } from "./dto/get.task.usecase.dto.js";

export class GetTaskUseCase {
    constructor(private readonly taskRepo: ITaskRepository) {}
    async execute(input: GetTaskUseCaseIn): Promise<GetTaskUseCaseOut> {
        return { task: await this.taskRepo.findById(input.taskId) };
    }
}
