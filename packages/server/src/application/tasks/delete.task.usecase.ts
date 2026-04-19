import type { MonitorPorts } from "~application/ports/index.js";

export class DeleteTaskUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(taskId: string): Promise<"deleted" | "not_found"> {
        if (!(await this.ports.tasks.findById(taskId))) return "not_found";
        const result = await this.ports.tasks.delete(taskId);
        for (const id of result.deletedIds) {
            this.ports.notifier.publish({ type: "task.deleted", payload: { taskId: id } });
        }
        return "deleted";
    }
}
