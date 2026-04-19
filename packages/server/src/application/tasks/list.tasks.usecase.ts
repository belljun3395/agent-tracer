import type { MonitoringTask } from "~domain/index.js";
import type { ITaskRepository } from "../ports/index.js";

export class ListTasksUseCase {
    constructor(private readonly taskRepo: ITaskRepository) {}
    async execute(): Promise<readonly MonitoringTask[]> {
        return this.taskRepo.findAll();
    }
}
