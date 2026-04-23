import type { MonitorPorts } from "~application/ports/index.js";
import type { TaskCompletionInput } from "./task.lifecycle.input.js";
import type { RecordedEventEnvelope } from "./task.lifecycle.result.js";
import { finalizeTask } from "./services/task.lifecycle.service.js";

export class CompleteTaskUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: TaskCompletionInput): Promise<RecordedEventEnvelope> {
        return finalizeTask(this.ports, { ...input, outcome: "completed" });
    }
}
