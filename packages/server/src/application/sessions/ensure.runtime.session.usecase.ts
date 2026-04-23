import { normalizeWorkspacePath } from "~domain/index.js";
import type { MonitorPorts } from "~application/ports/index.js";
import type { EnsureRuntimeSessionUseCaseIn, EnsureRuntimeSessionUseCaseOut } from "./ensure.runtime.session.usecase.dto.js";
import { startTask } from "../tasks/services/task.lifecycle.service.js";

export class EnsureRuntimeSessionUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: EnsureRuntimeSessionUseCaseIn): Promise<EnsureRuntimeSessionUseCaseOut> {
        const workspacePath = input.workspacePath
            ? normalizeWorkspacePath(input.workspacePath)
            : undefined;
        const binding = await this.ports.runtimeBindings.find(input.runtimeSource, input.runtimeSessionId);
        // Active binding: this runtime session is already attached to an open monitor session.
        // Reuse it so repeated runtime events do not create duplicate sessions.
        if (binding) {
            return {
                taskId: binding.taskId,
                sessionId: binding.monitorSessionId,
                taskCreated: false,
                sessionCreated: false,
            };
        }

        const existingTaskId = await this.ports.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
        if (existingTaskId) {
            const task = await this.ports.tasks.findById(existingTaskId);
            // Historical binding only: the runtime session is known, but no monitor session
            // is currently active. Read-only callers should attach to the latest session
            // without reopening the task.
            if (input.resume === false) {
                const sessions = await this.ports.sessions.findByTaskId(existingTaskId);
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
            // Resume path: keep the existing task association, but generate a fresh
            // random monitor session id for this new active observation window.
            const sessionId = globalThis.crypto.randomUUID();
            const startedAt = new Date().toISOString();
            if (task && (task.status !== "running" || task.runtimeSource !== input.runtimeSource)) {
                const resumedTask = await this.ports.tasks.upsert({
                    ...task,
                    taskKind: task.taskKind ?? "primary",
                    status: "running",
                    updatedAt: startedAt,
                    lastSessionStartedAt: startedAt,
                    runtimeSource: input.runtimeSource,
                });
                this.ports.notifier.publish({
                    type: "task.updated",
                    payload: resumedTask,
                });
            }

            const session = await this.ports.sessions.create({
                id: sessionId,
                taskId: existingTaskId,
                status: "running",
                startedAt,
            });
            this.ports.notifier.publish({
                type: "session.started",
                payload: session,
            });
            await this.ports.runtimeBindings.upsert({
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

        // First sighting: this runtime session has no active or historical binding, so
        // create both the task and its initial monitor session.
        const result = await startTask(this.ports, {
            ...(input.taskId ? { taskId: input.taskId } : {}),
            title: input.title,
            ...(workspacePath ? { workspacePath } : {}),
            runtimeSource: input.runtimeSource,
            ...(input.parentTaskId
                ? { taskKind: "background" as const, parentTaskId: input.parentTaskId }
                : {}),
            ...(input.parentSessionId
                ? { parentSessionId: input.parentSessionId }
                : {}),
        });
        const taskId = result.task.id;
        const sessionId = result.sessionId!;
        await this.ports.runtimeBindings.upsert({
            runtimeSource: input.runtimeSource,
            runtimeSessionId: input.runtimeSessionId,
            taskId,
            monitorSessionId: sessionId,
        });
        return { taskId, sessionId, taskCreated: true, sessionCreated: true };
    }
}
