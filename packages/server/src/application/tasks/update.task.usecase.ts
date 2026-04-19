import { createTaskSlug, type MonitoringTask } from "~domain/index.js";
import type { MonitorPorts } from "~application/ports/index.js";
import type { TaskPatchInput } from "./task.lifecycle.type.js";

export class UpdateTaskUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: TaskPatchInput): Promise<MonitoringTask | null> {
        const task = await this.ports.tasks.findById(input.taskId);
        if (!task) return null;

        const titleUpdate = input.title !== undefined ? input.title.trim() : undefined;
        const hasNewTitle = titleUpdate !== undefined && titleUpdate !== task.title;
        const hasNewStatus = input.status !== undefined && input.status !== task.status;
        if (!hasNewTitle && !hasNewStatus) return task;

        const updated = await this.ports.tasks.upsert({
            ...task,
            taskKind: task.taskKind ?? "primary",
            ...(hasNewTitle ? { title: titleUpdate, slug: createTaskSlug({ title: titleUpdate }) } : {}),
            ...(hasNewStatus ? { status: input.status } : {}),
            updatedAt: new Date().toISOString(),
        });
        this.ports.notifier.publish({ type: "task.updated", payload: updated });
        return updated;
    }
}
