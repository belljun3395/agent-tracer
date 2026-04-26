import type {
    INotificationPublisher,
    IRuntimeBindingRepository,
    ISessionRepository,
    ITaskRepository,
} from "~application/ports/index.js";
import { decideRuntimeSessionEnd, isTerminalTaskStatus } from "~domain/monitoring/index.js";
import type { MonitoringTask } from "~domain/monitoring/index.js";
import type { EndRuntimeSessionUseCaseIn } from "./dto/end.runtime.session.usecase.dto.js";
import type { TaskLifecycleService } from "~application/tasks/index.js";
import { TaskNotFoundError } from "../tasks/common/task.errors.js";

interface SessionTaskCompletionInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
}

export class EndRuntimeSessionUseCase {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly sessions: ISessionRepository,
        private readonly runtimeBindings: IRuntimeBindingRepository,
        private readonly notifier: INotificationPublisher,
        private readonly taskLifecycle: TaskLifecycleService,
    ) {}

    async execute(input: EndRuntimeSessionUseCaseIn): Promise<void> {
        const binding = await this.runtimeBindings.find(input.runtimeSource, input.runtimeSessionId);
        // No active binding: the runtime session is already unbound or was never
        // observed. If the caller explicitly completes the task, fall back to the
        // historical task association and then remove that stale binding row.
        if (!binding) {
            if (input.completeTask === true) {
                const taskId = await this.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
                if (taskId) {
                    await completeTaskIfIncomplete(this.tasks, this.taskLifecycle, {
                        taskId,
                        summary: input.summary ?? "Runtime session ended",
                    });
                    await this.runtimeBindings.delete(input.runtimeSource, input.runtimeSessionId);
                }
            }
            return;
        }

        const session = await this.sessions.findById(binding.monitorSessionId);
        // Stale active binding: the binding points at a missing or already-ended
        // monitor session. Clear it so a later ensure can resume with a fresh
        // observation window instead of reusing a closed session.
        if (!session || session.status !== "running") {
            await this.runtimeBindings.clearSession(input.runtimeSource, input.runtimeSessionId);
            if (input.completeTask === true) {
                await completeTaskIfIncomplete(this.tasks, this.taskLifecycle, {
                    taskId: binding.taskId,
                    summary: input.summary ?? "Runtime session ended",
                });
            }
            return;
        }

        const endedAt = new Date().toISOString();
        await this.sessions.updateStatus(binding.monitorSessionId, "completed", endedAt, input.summary);
        this.notifier.publish({
            type: "session.ended",
            payload: { ...session, status: "completed" as const, endedAt },
        });
        await this.runtimeBindings.clearSession(input.runtimeSource, input.runtimeSessionId);
        await completeBgTasks(this.tasks, this.taskLifecycle, input.backgroundCompletions);

        const task = await this.tasks.findById(binding.taskId);
        const hasRunningBackgroundChildren = task?.taskKind === "primary"
            ? await hasRunningBackgroundDescendants(this.tasks, binding.taskId)
            : false;

        if (task) {
            const decision = decideRuntimeSessionEnd({
                taskKind: task.taskKind ?? "primary",
                taskStatus: task.status,
                completeTask: input.completeTask ?? false,
                runningSessionCount: await this.sessions.countRunningByTaskId(binding.taskId),
                completionReason: input.completionReason,
                hasRunningBackgroundDescendants: hasRunningBackgroundChildren,
            });
            if (decision.action === "complete_task") {
                await completeTaskIfIncomplete(this.tasks, this.taskLifecycle, {
                    taskId: binding.taskId,
                    sessionId: binding.monitorSessionId,
                    summary: input.summary ?? decision.summary,
                });
                return;
            }
            if (decision.action === "move_task_to_waiting") {
                await setTaskStatus(this.tasks, this.notifier, binding.taskId, "waiting");
            }
        }
    }
}

async function hasRunningBackgroundDescendants(tasks: ITaskRepository, taskId: string): Promise<boolean> {
    const stack = [taskId];
    while (stack.length > 0) {
        const parentId = stack.pop();
        if (!parentId) continue;
        const children = await tasks.findChildren(parentId);
        for (const child of children) {
            if (child.taskKind === "background" && child.status === "running") return true;
            stack.push(child.id);
        }
    }
    return false;
}

async function setTaskStatus(
    tasks: ITaskRepository,
    notifier: INotificationPublisher,
    taskId: string,
    status: MonitoringTask["status"],
): Promise<MonitoringTask> {
    const updatedAt = new Date().toISOString();
    await tasks.updateStatus(taskId, status, updatedAt);
    const task = await tasks.findById(taskId);
    if (!task) throw new TaskNotFoundError(taskId);
    notifier.publish({ type: "task.updated", payload: task });
    return task;
}

async function completeTaskIfIncomplete(
    tasks: ITaskRepository,
    taskLifecycle: TaskLifecycleService,
    input: SessionTaskCompletionInput,
): Promise<void> {
    const task = await tasks.findById(input.taskId);
    if (!task || isTerminalTaskStatus(task.status)) return;
    await taskLifecycle.finalizeTask({
        taskId: input.taskId,
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        outcome: "completed",
    });
}

async function completeBgTasks(
    tasks: ITaskRepository,
    taskLifecycle: TaskLifecycleService,
    ids?: readonly string[],
): Promise<void> {
    if (!ids?.length) return;
    for (const bgTaskId of ids) {
        const bgTask = await tasks.findById(bgTaskId);
        if (bgTask?.status === "running") {
            await taskLifecycle.finalizeTask({
                taskId: bgTask.id,
                summary: "Background task completed",
                outcome: "completed",
            });
        }
    }
}
