import type { ITaskRepository } from "../ports/index.js";

export class GetOverviewUseCase {
    constructor(private readonly taskRepo: ITaskRepository) {}

    execute() {
        return this.taskRepo.getOverviewStats();
    }
}
