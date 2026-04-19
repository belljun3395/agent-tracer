import { createTaskSlug, type MonitoringTask } from "~domain/index.js";
import type { MonitorPorts } from "~application/ports/index.js";
import type { TaskLinkInput } from "./task.lifecycle.type.js";
import { requireTask } from "./task.lifecycle.ops.js";

export class LinkTaskUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: TaskLinkInput): Promise<MonitoringTask> {
        const task = await requireTask(this.ports, input.taskId);
        const t = input.title?.trim();
        const updated = await this.ports.tasks.upsert({
            ...task,
            taskKind: input.taskKind ?? task.taskKind ?? "primary",
            ...(t ? { title: t, slug: createTaskSlug({ title: t }) } : {}),
            ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
            ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
            ...(input.backgroundTaskId ? { backgroundTaskId: input.backgroundTaskId } : {}),
            updatedAt: new Date().toISOString(),
        });
        this.ports.notifier.publish({ type: "task.updated", payload: updated });
        return updated;
    }
}
