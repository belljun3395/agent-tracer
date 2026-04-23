import type { MonitorPorts } from "~application/ports/index.js";
import type { TaskCompletionInput } from "./task.lifecycle.type.js";
import type { RecordedEventEnvelope } from "./task.lifecycle.type.js";
import { finishTask } from "./services/task.lifecycle.service.js";

export class CompleteTaskUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: TaskCompletionInput): Promise<RecordedEventEnvelope> {
        return finishTask(this.ports, input, "completed", "task.complete", input.summary);
    }
}
