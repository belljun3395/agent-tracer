import { normalizeWorkspacePath, type MonitoringTask } from "~domain/index.js";
import type { MonitorPorts } from "~application/ports/index.js";
import type {
    RuntimeSessionEndInput,
    RuntimeSessionEnsureInput,
    RuntimeSessionEnsureResult,
    TaskCompletionInput,
    TaskStartInput,
} from "../task.lifecycle.type.js";
import { shouldAutoCompletePrimary, shouldMovePrimaryToWaiting } from "./session.lifecycle.service.js";

interface StartTaskResult {
    readonly task: MonitoringTask;
    readonly sessionId?: string;
}

export interface TaskRuntimeSessionContext {
    readonly ports: MonitorPorts;
    readonly startTask: (input: TaskStartInput) => Promise<StartTaskResult>;
    readonly completeTaskIfIncomplete: (input: TaskCompletionInput) => Promise<void>;
    readonly completeBgTasks: (ids?: readonly string[]) => Promise<void>;
    readonly hasRunningBackgroundDescendants: (taskId: string) => Promise<boolean>;
    readonly setTaskStatus: (taskId: string, status: MonitoringTask["status"]) => Promise<MonitoringTask>;
}

export async function ensureRuntimeSession(
    context: TaskRuntimeSessionContext,
    input: RuntimeSessionEnsureInput,
): Promise<RuntimeSessionEnsureResult> {
    const workspacePath = input.workspacePath
        ? normalizeWorkspacePath(input.workspacePath)
        : undefined;
    const binding = await context.ports.runtimeBindings.find(input.runtimeSource, input.runtimeSessionId);
    if (binding) {
        return {
            taskId: binding.taskId,
            sessionId: binding.monitorSessionId,
            taskCreated: false,
            sessionCreated: false,
        };
    }

    const existingTaskId = await context.ports.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
    if (existingTaskId) {
        const sessionId = globalThis.crypto.randomUUID();
        const startedAt = new Date().toISOString();
        const task = await context.ports.tasks.findById(existingTaskId);
        if (task && (task.status !== "running" || task.runtimeSource !== input.runtimeSource)) {
            const resumedTask = await context.ports.tasks.upsert({
                ...task,
                taskKind: task.taskKind ?? "primary",
                status: "running",
                updatedAt: startedAt,
                lastSessionStartedAt: startedAt,
                runtimeSource: input.runtimeSource,
            });
            context.ports.notifier.publish({
                type: "task.updated",
                payload: resumedTask,
            });
        }

        const session = await context.ports.sessions.create({
            id: sessionId,
            taskId: existingTaskId,
            status: "running",
            startedAt,
        });
        context.ports.notifier.publish({
            type: "session.started",
            payload: session,
        });
        await context.ports.runtimeBindings.upsert({
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

    const result = await context.startTask({
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
    await context.ports.runtimeBindings.upsert({
        runtimeSource: input.runtimeSource,
        runtimeSessionId: input.runtimeSessionId,
        taskId,
        monitorSessionId: sessionId,
    });
    return { taskId, sessionId, taskCreated: true, sessionCreated: true };
}

export async function endRuntimeSession(
    context: TaskRuntimeSessionContext,
    input: RuntimeSessionEndInput,
): Promise<void> {
    const binding = await context.ports.runtimeBindings.find(input.runtimeSource, input.runtimeSessionId);
    if (!binding) {
        if (input.completeTask === true) {
            const taskId = await context.ports.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
            if (taskId) {
                await context.completeTaskIfIncomplete({
                    taskId,
                    summary: input.summary ?? "Runtime session ended",
                });
                await context.ports.runtimeBindings.delete(input.runtimeSource, input.runtimeSessionId);
            }
        }
        return;
    }

    const session = await context.ports.sessions.findById(binding.monitorSessionId);
    if (!session || session.status !== "running") {
        return;
    }

    const endedAt = new Date().toISOString();
    await context.ports.sessions.updateStatus(binding.monitorSessionId, "completed", endedAt, input.summary);
    context.ports.notifier.publish({
        type: "session.ended",
        payload: { ...session, status: "completed" as const, endedAt },
    });
    await context.ports.runtimeBindings.clearSession(input.runtimeSource, input.runtimeSessionId);
    await context.completeBgTasks(input.backgroundCompletions);

    const task = await context.ports.tasks.findById(binding.taskId);
    const hasRunningBackgroundDescendants = task?.taskKind === "primary"
        ? await context.hasRunningBackgroundDescendants(binding.taskId)
        : false;

    if (input.completeTask === true && task) {
        if (shouldAutoCompletePrimary({
            taskKind: task.taskKind ?? "primary",
            completeTask: true,
            runningSessionCount: await context.ports.sessions.countRunningByTaskId(binding.taskId),
            completionReason: input.completionReason,
            hasRunningBackgroundDescendants,
        })) {
            await context.completeTaskIfIncomplete({
                taskId: binding.taskId,
                sessionId: binding.monitorSessionId,
                summary: input.summary ?? "Runtime session ended",
            });
        }
        return;
    }

    if (
        task?.taskKind === "background"
        && task.status === "running"
        && (await context.ports.sessions.countRunningByTaskId(binding.taskId)) === 0
    ) {
        await context.completeTaskIfIncomplete({
            taskId: binding.taskId,
            sessionId: binding.monitorSessionId,
            summary: input.summary ?? "Background task completed",
        });
        return;
    }

    if (
        task
        && shouldMovePrimaryToWaiting({
            taskKind: task.taskKind ?? "primary",
            completeTask: input.completeTask ?? false,
            runningSessionCount: await context.ports.sessions.countRunningByTaskId(binding.taskId),
            completionReason: input.completionReason,
            hasRunningBackgroundDescendants,
        })
    ) {
        await context.setTaskStatus(binding.taskId, "waiting");
    }
}
