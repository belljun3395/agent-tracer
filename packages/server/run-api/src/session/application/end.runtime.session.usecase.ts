import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional } from "typeorm-transactional";
import { isTerminalTaskStatus, RuntimeSessionEnd } from "../domain/runtime.session.end.model.js";
import { SessionLifecycleService } from "../service/session.lifecycle.service.js";
import { RuntimeBindingService } from "../service/runtime.binding.service.js";
import {
    CLOCK_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    TASK_LIFECYCLE_ACCESS_PORT,
} from "./outbound/tokens.js";
import { TASK_ACCESS } from "@monitor/run-api/task/public/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { ISessionNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type { ITaskAccess } from "@monitor/run-api/task/public/iservice/task.access.iservice.js";
import type { MonitoringTask } from "@monitor/run-api/task/public/types/task.types.js";
import type { TaskStatus } from "@monitor/run-api/task/public/dto/task.snapshot.dto.js";
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
        @Inject(TASK_ACCESS) private readonly tasks: ITaskAccess,
        @Inject(TASK_LIFECYCLE_ACCESS_PORT) private readonly taskLifecycle: ITaskLifecycleAccess,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: ISessionNotificationPublisher,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    @Transactional()
    async execute(input: EndRuntimeSessionIn): Promise<void> {
        const binding = await this.runtimeBindings.findActive(input.runtimeSource, input.runtimeSessionId);

        if (!binding) {
            // 활성 세션이 없어도 완료 요청이면 과거 바인딩의 태스크를 닫는다.
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

        if (!session || session.status !== "running") {
            // stale 바인딩은 세션 상태를 신뢰하지 않고 연결만 정리한다.
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
            type: NOTIFICATION_TYPE.sessionEnded,
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
                if (task.taskKind === "primary" && hasRunningBackgroundChildren) {
                    // primary가 명시적으로 끝나면 남은 background도 완료로 수렴시킨다.
                    await this.cascadeCompleteBackgroundDescendants(binding.taskId);
                }
                return;
            }
            if (decision.action === "move_task_to_waiting") {
                await this.setTaskStatus(binding.taskId, "waiting");
            }
        }
    }

    private async cascadeCompleteBackgroundDescendants(rootTaskId: string): Promise<void> {
        const stack = [rootTaskId];
        while (stack.length > 0) {
            const parentId = stack.pop();
            if (!parentId) continue;
            const children = await this.tasks.findChildren(parentId);
            for (const child of children) {
                stack.push(child.id);
                if (child.taskKind === "background" && child.status === "running") {
                    await this.taskLifecycle.finalizeTask({
                        taskId: child.id,
                        summary: "Background task cascade-completed with parent",
                        outcome: "completed",
                    });
                }
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

    private async setTaskStatus(taskId: string, status: TaskStatus): Promise<MonitoringTask> {
        const updatedAt = this.clock.nowIso();
        await this.tasks.updateStatus(taskId, status, updatedAt);
        const task = await this.tasks.findById(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);
        this.notifier.publish({ type: NOTIFICATION_TYPE.taskUpdated, payload: task });
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
