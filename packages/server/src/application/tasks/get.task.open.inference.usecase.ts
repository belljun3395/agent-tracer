import { buildOpenInferenceTaskExport } from "../interop/index.js";
import type { ITaskRepository, IEventRepository } from "../ports/index.js";

export class GetTaskOpenInferenceUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
    ) {}
    async execute(taskId: string): Promise<{ openinference: ReturnType<typeof buildOpenInferenceTaskExport> } | undefined> {
        const task = await this.taskRepo.findById(taskId);
        if (!task) return undefined;
        const timeline = await this.eventRepo.findByTaskId(taskId);
        return { openinference: buildOpenInferenceTaskExport(task, timeline) };
    }
}
