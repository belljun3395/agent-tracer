import type { TaskErrorInput } from "./task.lifecycle.input.js";
import type { RecordedEventEnvelope } from "./task.lifecycle.result.js";
import type { TaskLifecycleService } from "./services/task.lifecycle.service.js";

export class ErrorTaskUseCase {
    constructor(private readonly taskLifecycle: TaskLifecycleService) {}

    async execute(input: TaskErrorInput): Promise<RecordedEventEnvelope> {
        return this.taskLifecycle.finalizeTask({ ...input, outcome: "errored" });
    }
}
