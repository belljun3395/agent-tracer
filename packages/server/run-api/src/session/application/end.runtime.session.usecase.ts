import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional } from "typeorm-transactional";
import { MONITORING_TASK_KIND } from "@monitor/run-api/task/common/task.status.const.js";
import { isRunningSession } from "../domain/session.predicates.policy.js";
import {
    isPrimaryTask,
    isRunningBackgroundTask,
    isTaskRunning,
    isTaskTerminal,
} from "@monitor/run-api/task/domain/task.predicates.policy.js";
import { RuntimeSessionEnd } from "../domain/runtime.session.end.policy.js";
import { SessionRepository } from "../repository/session.repository.js";
import { RuntimeBindingRepository } from "../repository/runtime.binding.repository.js";
import { CLOCK_PORT, NOTIFICATION_PUBLISHER_PORT } from "./outbound/tokens.js";
import { TASK_ACCESS, TASK_LIFECYCLE } from "@monitor/run-api/task/public/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { ISessionNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type { ITaskAccess } from "@monitor/run-api/task/public/iservice/task.access.iservice.js";
import type { ITaskLifecycle } from "@monitor/run-api/task/public/iservice/task.lifecycle.iservice.js";
import type { MonitoringTask } from "@monitor/run-api/task/public/types/task.types.js";
import type { TaskStatus } from "@monitor/run-api/task/public/dto/task.snapshot.dto.js";
import type { EndRuntimeSessionIn } from "./dto/end.runtime.session.dto.js";

interface SessionTaskCompletionInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
}

@Injectable()
export class EndRuntimeSessionUseCase {
    constructor(
        private readonly sessionRepo: SessionRepository,
        private readonly runtimeBindingRepo: RuntimeBindingRepository,
        @Inject(TASK_ACCESS) private readonly tasks: ITaskAccess,
        @Inject(TASK_LIFECYCLE) private readonly taskLifecycle: ITaskLifecycle,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: ISessionNotificationPublisher,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    @Transactional()
    async execute(input: EndRuntimeSessionIn): Promise<void> {
        const binding = await this.runtimeBindingRepo.findActive(input.runtimeSource, input.runtimeSessionId);

        if (!binding) {
            // 활성 세션이 없어도 완료 요청이면 과거 바인딩의 태스크를 닫는다.
            if (input.completeTask === true) {
                const entity = await this.runtimeBindingRepo.findByKey(input.runtimeSource, input.runtimeSessionId);
                const taskId = entity?.taskId ?? null;
                if (taskId) {
                    await this.completeTaskIfIncomplete({
                        taskId,
                        summary: input.summary ?? "Runtime session ended",
                    });
                    await this.runtimeBindingRepo.delete(input.runtimeSource, input.runtimeSessionId);
                }
            }
            return;
        }

        const session = await this.sessionRepo.findById(binding.monitorSessionId!);

        if (!session || !isRunningSession(session)) {
            // stale 바인딩은 세션 상태를 신뢰하지 않고 연결만 정리한다.
            await this.clearSession(input.runtimeSource, input.runtimeSessionId);
            if (input.completeTask === true) {
                await this.completeTaskIfIncomplete({
                    taskId: binding.taskId,
                    summary: input.summary ?? "Runtime session ended",
                });
            }
            return;
        }

        const endedAt = this.clock.nowIso();
        await this.sessionRepo.updateStatus(binding.monitorSessionId!, "completed", endedAt, input.summary);
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sessionEnded,
            payload: { ...session, status: "completed" as const, endedAt },
        });
        await this.clearSession(input.runtimeSource, input.runtimeSessionId);
        await this.completeBgTasks(input.backgroundCompletions);

        const task = await this.tasks.findById(binding.taskId);
        const hasRunningBackgroundChildren = task != null && isPrimaryTask(task)
            ? await this.hasRunningBackgroundDescendants(binding.taskId)
            : false;

        if (task) {
            const sessionEnd = new RuntimeSessionEnd({
                taskKind: task.taskKind ?? MONITORING_TASK_KIND.primary,
                taskStatus: task.status,
                completeTask: input.completeTask ?? false,
                runningSessionCount: await this.sessionRepo.countRunningByTaskId(binding.taskId),
                completionReason: input.completionReason,
                hasRunningBackgroundDescendants: hasRunningBackgroundChildren,
            });
            const decision = sessionEnd.decide();
            if (decision.action === "complete_task") {
                await this.completeTaskIfIncomplete({
                    taskId: binding.taskId,
                    sessionId: binding.monitorSessionId!,
                    summary: input.summary ?? decision.summary,
                });
                if (isPrimaryTask(task) && hasRunningBackgroundChildren) {
                    await this.cascadeCompleteBackgroundDescendants(binding.taskId);
                }
                return;
            }
            if (decision.action === "move_task_to_waiting") {
                await this.setTaskStatus(binding.taskId, "waiting");
            }
        }
    }

    private async clearSession(runtimeSource: string, runtimeSessionId: string): Promise<void> {
        const entity = await this.runtimeBindingRepo.findByKey(runtimeSource, runtimeSessionId);
        if (!entity) return;
        entity.monitorSessionId = null;
        entity.updatedAt = this.clock.nowIso();
        await this.runtimeBindingRepo.save(entity);
    }

    private async cascadeCompleteBackgroundDescendants(rootTaskId: string): Promise<void> {
        const stack = [rootTaskId];
        while (stack.length > 0) {
            const parentId = stack.pop();
            if (!parentId) continue;
            const children = await this.tasks.findChildren(parentId);
            for (const child of children) {
                stack.push(child.id);
                if (isRunningBackgroundTask(child)) {
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
                if (isRunningBackgroundTask(child)) return true;
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
        if (!task || isTaskTerminal(task)) return;
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
            if (bgTask != null && isTaskRunning(bgTask)) {
                await this.taskLifecycle.finalizeTask({
                    taskId: bgTask.id,
                    summary: "Background task completed",
                    outcome: "completed",
                });
            }
        }
    }
}
