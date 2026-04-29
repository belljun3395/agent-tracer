import { Inject, Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { isTerminalTaskStatus, RuntimeSessionEnd } from "../domain/runtime.session.end.model.js";
import { SessionLifecycleService } from "../service/session.lifecycle.service.js";
import { RuntimeBindingService } from "../service/runtime.binding.service.js";
import {
    CLOCK_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    TASK_ACCESS_PORT,
    TASK_LIFECYCLE_ACCESS_PORT,
} from "./outbound/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { ISessionNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type {
    ITaskAccess,
    TaskAccessRecord,
    TaskAccessStatus,
} from "./outbound/task.access.port.js";
import type { ITaskLifecycleAccess } from "./outbound/task.lifecycle.access.port.js";
import type { EndRuntimeSessionIn } from "./dto/end.runtime.session.dto.js";

interface SessionTaskCompletionInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
}

@Injectable()
export class EndRuntimeSessionUseCase {
    constructor(
        private readonly sessions: SessionLifecycleService,
        private readonly runtimeBindings: RuntimeBindingService,
        @Inject(TASK_ACCESS_PORT) private readonly tasks: ITaskAccess,
        @Inject(TASK_LIFECYCLE_ACCESS_PORT) private readonly taskLifecycle: ITaskLifecycleAccess,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: ISessionNotificationPublisher,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    @Transactional()
    async execute(input: EndRuntimeSessionIn): Promise<void> {
        const binding = await this.runtimeBindings.findActive(input.runtimeSource, input.runtimeSessionId);
        // No active binding: clean up the historical association if the caller asked to.
        if (!binding) {
            if (input.completeTask === true) {
                const taskId = await this.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
                if (taskId) {
                    await this.completeTaskIfIncomplete({
                        taskId,
                        summary: input.summary ?? "Runtime session ended",
                    });
                    await this.runtimeBindings.delete(input.runtimeSource, input.runtimeSessionId);
                }
            }
            return;
        }

        const session = await this.sessions.findById(binding.monitorSessionId);
        // Stale binding: the session is already gone or ended.
        if (!session || session.status !== "running") {
            await this.runtimeBindings.clearSession(input.runtimeSource, input.runtimeSessionId);
            if (input.completeTask === true) {
                await this.completeTaskIfIncomplete({
                    taskId: binding.taskId,
                    summary: input.summary ?? "Runtime session ended",
                });
            }
            return;
        }

        const endedAt = this.clock.nowIso();
        await this.sessions.updateStatus(binding.monitorSessionId, "completed", endedAt, input.summary);
        this.notifier.publish({
            type: "session.ended",
            payload: { ...session, status: "completed" as const, endedAt },
        });
        await this.runtimeBindings.clearSession(input.runtimeSource, input.runtimeSessionId);
        await this.completeBgTasks(input.backgroundCompletions);

        const task = await this.tasks.findById(binding.taskId);
        const hasRunningBackgroundChildren = task?.taskKind === "primary"
            ? await this.hasRunningBackgroundDescendants(binding.taskId)
            : false;

        if (task) {
            const sessionEnd = new RuntimeSessionEnd({
                taskKind: task.taskKind ?? "primary",
                taskStatus: task.status,
                completeTask: input.completeTask ?? false,
                runningSessionCount: await this.sessions.countRunningByTaskId(binding.taskId),
                completionReason: input.completionReason,
                hasRunningBackgroundDescendants: hasRunningBackgroundChildren,
            });
            const decision = sessionEnd.decide();
            if (decision.action === "complete_task") {
                await this.completeTaskIfIncomplete({
                    taskId: binding.taskId,
                    sessionId: binding.monitorSessionId,
                    summary: input.summary ?? decision.summary,
                });
                return;
            }
            if (decision.action === "move_task_to_waiting") {
                await this.setTaskStatus(binding.taskId, "waiting");
            }
        }
    }

    private async hasRunningBackgroundDescendants(taskId: string): Promise<boolean> {
        const stack = [taskId];
        while (stack.length > 0) {
            const parentId = stack.pop();
            if (!parentId) continue;
            const children = await this.tasks.findChildren(parentId);
            for (const child of children) {
                if (child.taskKind === "background" && child.status === "running") return true;
                stack.push(child.id);
            }
        }
        return false;
    }

    private async setTaskStatus(taskId: string, status: TaskAccessStatus): Promise<TaskAccessRecord> {
        const updatedAt = this.clock.nowIso();
        await this.tasks.updateStatus(taskId, status, updatedAt);
        const task = await this.tasks.findById(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);
        this.notifier.publish({ type: "task.updated", payload: task });
        return task;
    }

    private async completeTaskIfIncomplete(input: SessionTaskCompletionInput): Promise<void> {
        const task = await this.tasks.findById(input.taskId);
        if (!task || isTerminalTaskStatus(task.status)) return;
        await this.taskLifecycle.finalizeTask({
            taskId: input.taskId,
            ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
            ...(input.summary !== undefined ? { summary: input.summary } : {}),
            outcome: "completed",
        });
    }

    private async completeBgTasks(ids?: readonly string[]): Promise<void> {
        if (!ids?.length) return;
        for (const bgTaskId of ids) {
            const bgTask = await this.tasks.findById(bgTaskId);
            if (bgTask?.status === "running") {
                await this.taskLifecycle.finalizeTask({
                    taskId: bgTask.id,
                    summary: "Background task completed",
                    outcome: "completed",
                });
            }
        }
    }
}
