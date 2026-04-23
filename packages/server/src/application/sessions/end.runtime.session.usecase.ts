import type { MonitorPorts } from "~application/ports/index.js";
import type { EndRuntimeSessionUseCaseIn } from "./end.runtime.session.usecase.dto.js";
import { completeTaskIfIncomplete, completeBgTasks, hasRunningBackgroundDescendants, setTaskStatus } from "../tasks/task.lifecycle.ops.js";
import { shouldAutoCompletePrimary, shouldMovePrimaryToWaiting } from "../tasks/services/session.lifecycle.service.js";

export class EndRuntimeSessionUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: EndRuntimeSessionUseCaseIn): Promise<void> {
        const binding = await this.ports.runtimeBindings.find(input.runtimeSource, input.runtimeSessionId);
        // No active binding: the runtime session is already unbound or was never
        // observed. If the caller explicitly completes the task, fall back to the
        // historical task association and then remove that stale binding row.
        if (!binding) {
            if (input.completeTask === true) {
                const taskId = await this.ports.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
                if (taskId) {
                    await completeTaskIfIncomplete(this.ports, {
                        taskId,
                        summary: input.summary ?? "Runtime session ended",
                    });
                    await this.ports.runtimeBindings.delete(input.runtimeSource, input.runtimeSessionId);
                }
            }
            return;
        }

        const session = await this.ports.sessions.findById(binding.monitorSessionId);
        // Stale active binding: the binding points at a missing or already-ended
        // monitor session, so there is nothing left to close.
        if (!session || session.status !== "running") {
            return;
        }

        const endedAt = new Date().toISOString();
        await this.ports.sessions.updateStatus(binding.monitorSessionId, "completed", endedAt, input.summary);
        this.ports.notifier.publish({
            type: "session.ended",
            payload: { ...session, status: "completed" as const, endedAt },
        });
        await this.ports.runtimeBindings.clearSession(input.runtimeSource, input.runtimeSessionId);
        await completeBgTasks(this.ports, input.backgroundCompletions);

        const task = await this.ports.tasks.findById(binding.taskId);
        const hasRunningBackgroundChildren = task?.taskKind === "primary"
            ? await hasRunningBackgroundDescendants(this.ports, binding.taskId)
            : false;

        if (input.completeTask === true && task) {
            // Explicit completion path: the runtime says the work item is done.
            // Complete the primary task only when lifecycle rules allow it.
            if (shouldAutoCompletePrimary({
                taskKind: task.taskKind ?? "primary",
                completeTask: true,
                runningSessionCount: await this.ports.sessions.countRunningByTaskId(binding.taskId),
                completionReason: input.completionReason,
                hasRunningBackgroundDescendants: hasRunningBackgroundChildren,
            })) {
                await completeTaskIfIncomplete(this.ports, {
                    taskId: binding.taskId,
                    sessionId: binding.monitorSessionId,
                    summary: input.summary ?? "Runtime session ended",
                });
            }
            return;
        }

        // Background task path: background tasks complete automatically once their
        // last running monitor session ends.
        if (
            task?.taskKind === "background"
            && task.status === "running"
            && (await this.ports.sessions.countRunningByTaskId(binding.taskId)) === 0
        ) {
            await completeTaskIfIncomplete(this.ports, {
                taskId: binding.taskId,
                sessionId: binding.monitorSessionId,
                summary: input.summary ?? "Background task completed",
            });
            return;
        }

        // Primary task pause path: the active session ended, but the task should stay
        // open because completion was not requested or background work is still running.
        if (
            task
            && shouldMovePrimaryToWaiting({
                taskKind: task.taskKind ?? "primary",
                completeTask: input.completeTask ?? false,
                runningSessionCount: await this.ports.sessions.countRunningByTaskId(binding.taskId),
                completionReason: input.completionReason,
                hasRunningBackgroundDescendants: hasRunningBackgroundChildren,
            })
        ) {
            await setTaskStatus(this.ports, binding.taskId, "waiting");
        }
    }
}
