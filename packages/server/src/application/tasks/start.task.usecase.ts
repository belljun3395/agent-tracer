import type { MonitorPorts } from "~application/ports/index.js";
import type { TaskStartInput } from "./task.lifecycle.type.js";
import type { RecordedEventEnvelope } from "./task.lifecycle.type.js";
import { startTask } from "./services/task.lifecycle.service.js";

export class StartTaskUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: TaskStartInput): Promise<RecordedEventEnvelope> {
        return startTask(this.ports, input);
    }
}
