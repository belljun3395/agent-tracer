import type { ITaskRepository, IEventRepository } from "../ports/index.js";
import type { GetTaskOpenInferenceUseCaseIn, GetTaskOpenInferenceUseCaseOut } from "./dto/get.task.open.inference.usecase.dto.js";
import { toOpenInferenceTaskExport } from "./openinference.js";

export class GetTaskOpenInferenceUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
    ) {}
    async execute(input: GetTaskOpenInferenceUseCaseIn): Promise<GetTaskOpenInferenceUseCaseOut | undefined> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) return undefined;
        const timeline = await this.eventRepo.findByTaskId(input.taskId);
        return { openinference: toOpenInferenceTaskExport(task, timeline) };
    }
}
