import { Inject, Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { normalizeWorkspacePath } from "~work/task/public/helpers.js";
import { SessionLifecycleService } from "../service/session.lifecycle.service.js";
import { RuntimeBindingService } from "../service/runtime.binding.service.js";
import {
    NOTIFICATION_PUBLISHER_PORT,
    TASK_ACCESS_PORT,
    TASK_LIFECYCLE_ACCESS_PORT,
} from "./outbound/tokens.js";
import type { ISessionNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type { ITaskAccess } from "./outbound/task.access.port.js";
import type { ITaskLifecycleAccess } from "./outbound/task.lifecycle.access.port.js";
import type {
    EnsureRuntimeSessionIn,
    EnsureRuntimeSessionOut,
} from "./dto/ensure.runtime.session.dto.js";

@Injectable()
export class EnsureRuntimeSessionUseCase {
    constructor(
        private readonly sessions: SessionLifecycleService,
        private readonly runtimeBindings: RuntimeBindingService,
        @Inject(TASK_ACCESS_PORT) private readonly tasks: ITaskAccess,
        @Inject(TASK_LIFECYCLE_ACCESS_PORT) private readonly taskLifecycle: ITaskLifecycleAccess,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: ISessionNotificationPublisher,
    ) {}

    @Transactional()
    async execute(input: EnsureRuntimeSessionIn): Promise<EnsureRuntimeSessionOut> {
        const workspacePath = input.workspacePath
            ? normalizeWorkspacePath(input.workspacePath)
            : undefined;

        // Active binding: this runtime session is already attached to an open monitor session.
        const binding = await this.runtimeBindings.findActive(input.runtimeSource, input.runtimeSessionId);
        if (binding) {
            const session = await this.sessions.findById(binding.monitorSessionId);
            if (!session || session.status !== "running") {
                await this.runtimeBindings.clearSession(input.runtimeSource, input.runtimeSessionId);
            } else {
                return {
                    taskId: binding.taskId,
                    sessionId: binding.monitorSessionId,
                    taskCreated: false,
                    sessionCreated: false,
                };
            }
        }

        const existingTaskId = await this.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
        if (existingTaskId) {
            const task = await this.tasks.findById(existingTaskId);
            // Historical binding only: read-only callers attach to the latest session
            // without reopening the task.
            if (input.resume === false) {
                const sessions = await this.sessions.findByTaskId(existingTaskId);
                const latest = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
                if (latest) {
                    return {
                        taskId: existingTaskId,
                        sessionId: latest.id,
                        taskCreated: false,
                        sessionCreated: false,
                    };
                }
            }
            // Resume path: keep the task association, generate a fresh session id.
            const sessionId = globalThis.crypto.randomUUID();
            const startedAt = new Date().toISOString();
            if (task && (task.status !== "running" || task.runtimeSource !== input.runtimeSource)) {
                const resumedTask = await this.tasks.upsert({
                    ...task,
                    taskKind: task.taskKind ?? "primary",
                    status: "running",
                    updatedAt: startedAt,
                    lastSessionStartedAt: startedAt,
                    runtimeSource: input.runtimeSource,
                });
                this.notifier.publish({ type: "task.updated", payload: resumedTask });
            }

            const session = await this.sessions.create({
                id: sessionId,
                taskId: existingTaskId,
                status: "running",
                startedAt,
            });
            this.notifier.publish({ type: "session.started", payload: session });
            await this.runtimeBindings.upsert({
                runtimeSource: input.runtimeSource,
                runtimeSessionId: input.runtimeSessionId,
                taskId: existingTaskId,
                monitorSessionId: sessionId,
            });
            return {
                taskId: existingTaskId,
                sessionId,
                taskCreated: false,
                sessionCreated: true,
            };
        }

        // First sighting: create both the task and its initial monitor session.
        const result = await this.taskLifecycle.startTask({
            ...(input.taskId ? { taskId: input.taskId } : {}),
            title: input.title,
            ...(workspacePath ? { workspacePath } : {}),
            runtimeSource: input.runtimeSource,
            ...(input.parentTaskId
                ? { taskKind: "background" as const, parentTaskId: input.parentTaskId }
                : {}),
            ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
        });
        const taskId = result.task.id;
        const sessionId = result.sessionId!;
        await this.runtimeBindings.upsert({
            runtimeSource: input.runtimeSource,
            runtimeSessionId: input.runtimeSessionId,
            taskId,
            monitorSessionId: sessionId,
        });
        return { taskId, sessionId, taskCreated: true, sessionCreated: true };
    }
}
