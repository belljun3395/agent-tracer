import type {
    IEventRepository,
    INotificationPublisher,
    ISessionRepository,
    ITaskRepository,
} from "~application/ports/index.js";
import type { TaskErrorInput } from "./task.lifecycle.input.js";
import type { RecordedEventEnvelope } from "./task.lifecycle.result.js";
import { finalizeTask } from "./services/task.lifecycle.service.js";

export class ErrorTaskUseCase {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly sessions: ISessionRepository,
        private readonly events: IEventRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: TaskErrorInput): Promise<RecordedEventEnvelope> {
        return finalizeTask(this.tasks, this.sessions, this.events, this.notifier, { ...input, outcome: "errored" });
    }
}
