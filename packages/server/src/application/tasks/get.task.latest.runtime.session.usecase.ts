import type { IRuntimeBindingRepository } from "../ports/index.js";

export class GetTaskLatestRuntimeSessionUseCase {
    constructor(private readonly runtimeBindings: IRuntimeBindingRepository) {}
    async execute(taskId: string): Promise<{ runtimeSource: string; runtimeSessionId: string } | null> {
        return this.runtimeBindings.findLatestByTaskId(taskId);
    }
}
