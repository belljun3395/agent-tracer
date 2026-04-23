import type { MonitorPorts } from "~application/ports/index.js";
import type { TaskErrorInput } from "./task.lifecycle.input.js";
import type { RecordedEventEnvelope } from "./task.lifecycle.result.js";
import { finalizeTask } from "./services/task.lifecycle.service.js";

export class ErrorTaskUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: TaskErrorInput): Promise<RecordedEventEnvelope> {
        return finalizeTask(this.ports, { ...input, outcome: "errored" });
    }
}
