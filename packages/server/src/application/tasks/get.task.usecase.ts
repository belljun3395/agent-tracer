import type { TaskReadPort } from "~application/ports/tasks/task.read.port.js";
import type { GetTaskUseCaseIn, GetTaskUseCaseOut } from "./dto/get.task.usecase.dto.js";

export class GetTaskUseCase {
    constructor(private readonly taskRepo: TaskReadPort) {}
    async execute(input: GetTaskUseCaseIn): Promise<GetTaskUseCaseOut> {
        return { task: await this.taskRepo.findById(input.taskId) };
    }
}
