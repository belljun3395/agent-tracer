import type { TaskCompletionInput } from "./task.lifecycle.input.js";
import type { RecordedEventEnvelope } from "./task.lifecycle.result.js";
import type { TaskLifecycleService } from "./services/task.lifecycle.service.js";

export class CompleteTaskUseCase {
    constructor(private readonly taskLifecycle: TaskLifecycleService) {}

    async execute(input: TaskCompletionInput): Promise<RecordedEventEnvelope> {
        return this.taskLifecycle.finalizeTask({ ...input, outcome: "completed" });
    }
}
