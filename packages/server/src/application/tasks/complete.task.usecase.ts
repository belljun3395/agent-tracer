import type { MonitorPorts } from "~application/ports/index.js";
import type { TaskCompletionInput } from "./task.lifecycle.type.js";
import type { RecordedEventEnvelope } from "./task.lifecycle.type.js";
import { completeTask } from "./task.lifecycle.ops.js";

export class CompleteTaskUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: TaskCompletionInput): Promise<RecordedEventEnvelope> {
        return completeTask(this.ports, input);
    }
}
