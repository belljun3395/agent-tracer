import type {
    IEventRepository,
    INotificationPublisher,
    IRuntimeBindingRepository,
    ISessionRepository,
    ITaskRepository,
} from "~application/ports/index.js";
import type { MonitoringTask } from "~domain/index.js";
import type { EndRuntimeSessionUseCaseIn } from "./end.runtime.session.usecase.dto.js";
import { finalizeTask } from "../tasks/services/task.lifecycle.service.js";

interface SessionTaskCompletionInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
}

export class EndRuntimeSessionUseCase {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly sessions: ISessionRepository,
        private readonly events: IEventRepository,
        private readonly runtimeBindings: IRuntimeBindingRepository,
        private readonly notifier: INotificationPublisher,
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
                    await completeTaskIfIncomplete(this.tasks, this.sessions, this.events, this.notifier, {
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
                await completeTaskIfIncomplete(this.tasks, this.sessions, this.events, this.notifier, {
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
        await completeBgTasks(this.tasks, this.sessions, this.events, this.notifier, input.backgroundCompletions);

        const task = await this.tasks.findById(binding.taskId);
        const hasRunningBackgroundChildren = task?.taskKind === "primary"
            ? await hasRunningBackgroundDescendants(this.tasks, binding.taskId)
            : false;

        if (input.completeTask === true && task) {
            // Explicit completion path: the runtime says the work item is done.
            // Complete the primary task only when lifecycle rules allow it.
            if (shouldAutoCompletePrimary({
                taskKind: task.taskKind ?? "primary",
                completeTask: true,
                runningSessionCount: await this.sessions.countRunningByTaskId(binding.taskId),
                completionReason: input.completionReason,
                hasRunningBackgroundDescendants: hasRunningBackgroundChildren,
            })) {
                await completeTaskIfIncomplete(this.tasks, this.sessions, this.events, this.notifier, {
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
            && (await this.sessions.countRunningByTaskId(binding.taskId)) === 0
        ) {
            await completeTaskIfIncomplete(this.tasks, this.sessions, this.events, this.notifier, {
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
                runningSessionCount: await this.sessions.countRunningByTaskId(binding.taskId),
                completionReason: input.completionReason,
                hasRunningBackgroundDescendants: hasRunningBackgroundChildren,
            })
        ) {
            await setTaskStatus(this.tasks, this.notifier, binding.taskId, "waiting");
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
    if (!task) throw new Error(`Task not found: ${taskId}`);
    notifier.publish({ type: "task.updated", payload: task });
    return task;
}

async function completeTaskIfIncomplete(
    tasks: ITaskRepository,
    sessions: ISessionRepository,
    events: IEventRepository,
    notifier: INotificationPublisher,
    input: SessionTaskCompletionInput,
): Promise<void> {
    const task = await tasks.findById(input.taskId);
    if (!task || task.status === "completed" || task.status === "errored") return;
    await finalizeTask(tasks, sessions, events, notifier, { ...input, outcome: "completed" });
}

async function completeBgTasks(
    tasks: ITaskRepository,
    sessions: ISessionRepository,
    events: IEventRepository,
    notifier: INotificationPublisher,
    ids?: readonly string[],
): Promise<void> {
    if (!ids?.length) return;
    for (const bgTaskId of ids) {
        const bgTask = await tasks.findById(bgTaskId);
        if (bgTask?.status === "running") {
            await finalizeTask(tasks, sessions, events, notifier, {
                taskId: bgTask.id,
                summary: "Background task completed",
                outcome: "completed",
            });
        }
    }
}

function shouldAutoCompletePrimary(opts: {
    taskKind: string;
    completeTask: boolean;
    runningSessionCount: number;
    completionReason?: string | undefined;
    hasRunningBackgroundDescendants?: boolean | undefined;
}): boolean {
    if (opts.taskKind !== "primary") return false;
    if (!opts.completeTask) return false;
    if (opts.runningSessionCount !== 0) return false;
    return !(opts.completionReason === "assistant_turn_complete" && opts.hasRunningBackgroundDescendants);
}

function shouldMovePrimaryToWaiting(opts: {
    taskKind: string;
    completeTask: boolean;
    runningSessionCount: number;
    completionReason?: string | undefined;
    hasRunningBackgroundDescendants?: boolean | undefined;
}): boolean {
    if (opts.taskKind !== "primary") return false;
    if (opts.runningSessionCount !== 0) return false;
    if (opts.completionReason === "idle") {
        return !opts.completeTask;
    }
    if (opts.completionReason === "assistant_turn_complete" && opts.hasRunningBackgroundDescendants) {
        return true;
    }
    if (opts.hasRunningBackgroundDescendants) return false;
    if (opts.completeTask) return false;
    return false;
}
