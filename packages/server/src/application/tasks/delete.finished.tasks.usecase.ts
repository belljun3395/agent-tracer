import type { MonitorPorts } from "~application/ports/index.js";

export class DeleteFinishedTasksUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(): Promise<number> {
        const count = await this.ports.tasks.deleteFinished();
        this.ports.notifier.publish({ type: "tasks.purged", payload: { count } });
        return count;
    }
}
