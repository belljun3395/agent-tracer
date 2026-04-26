import type { TaskReadPort, TimelineEventReadPort } from "../ports/index.js";
import type { GetTaskOpenInferenceUseCaseIn, GetTaskOpenInferenceUseCaseOut } from "./dto/get.task.open.inference.usecase.dto.js";
import { toOpenInferenceTaskExport } from "./openinference.js";

export class GetTaskOpenInferenceUseCase {
    constructor(
        private readonly taskRepo: TaskReadPort,
        private readonly eventRepo: TimelineEventReadPort,
    ) {}
    async execute(input: GetTaskOpenInferenceUseCaseIn): Promise<GetTaskOpenInferenceUseCaseOut | undefined> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) return undefined;
        const timeline = await this.eventRepo.findByTaskId(input.taskId);
        return { openinference: toOpenInferenceTaskExport(task, timeline) };
    }
}
