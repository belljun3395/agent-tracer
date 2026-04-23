import type { TaskStartInput } from "./task.lifecycle.input.js";
import type { RecordedEventEnvelope } from "./task.lifecycle.result.js";
import type { TaskLifecycleService } from "./services/task.lifecycle.service.js";

export class StartTaskUseCase {
    constructor(private readonly taskLifecycle: TaskLifecycleService) {}

    async execute(input: TaskStartInput): Promise<RecordedEventEnvelope> {
        return this.taskLifecycle.startTask(input);
    }
}
