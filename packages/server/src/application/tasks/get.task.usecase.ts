import type { MonitoringTask } from "~domain/index.js";
import type { ITaskRepository } from "../ports/index.js";

export class GetTaskUseCase {
    constructor(private readonly taskRepo: ITaskRepository) {}
    async execute(taskId: string): Promise<MonitoringTask | null> {
        return this.taskRepo.findById(taskId);
    }
}
