import type {
    IEventRepository,
    INotificationPublisher,
    ISessionRepository,
    ITaskRepository,
} from "~application/ports/index.js";
import type { TaskStartInput } from "./task.lifecycle.input.js";
import type { RecordedEventEnvelope } from "./task.lifecycle.result.js";
import { startTask } from "./services/task.lifecycle.service.js";

export class StartTaskUseCase {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly sessions: ISessionRepository,
        private readonly events: IEventRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: TaskStartInput): Promise<RecordedEventEnvelope> {
        return startTask(this.tasks, this.sessions, this.events, this.notifier, input);
    }
}
