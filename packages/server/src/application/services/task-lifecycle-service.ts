import { SessionId, createTaskSlug, normalizeWorkspacePath, TaskId, type EventId, type MonitoringEventKind, type MonitoringTask, type SessionId as MonitorSessionId, type TaskId as MonitorTaskId, } from "@monitor/core";
import type { MonitorPorts } from "../ports";
import type { TaskCompletionInput, TaskErrorInput, TaskLinkInput, TaskPatchInput, TaskRenameInput, TaskSessionEndInput, TaskStartInput, RuntimeSessionEnsureInput, RuntimeSessionEnsureResult, RuntimeSessionEndInput, } from "../types.js";
import { shouldAutoCompleteBackground, shouldAutoCompletePrimary, shouldMovePrimaryToWaiting, } from "./session-lifecycle-policy.js";
import { EventRecorder } from "./event-recorder.js";
export interface RecordedEventEnvelope {
    readonly task: MonitoringTask;
    readonly sessionId?: MonitorSessionId;
    readonly events: readonly {
        readonly id: EventId;
        readonly kind: MonitoringEventKind;
    }[];
}
export class TaskLifecycleService {
    private readonly recorder: EventRecorder;
    constructor(private readonly ports: MonitorPorts) {
        this.recorder = new EventRecorder(ports.events, ports.notifier);
    }
    async startTask(input: TaskStartInput): Promise<RecordedEventEnvelope> {
        const taskId = input.taskId ?? TaskId(globalThis.crypto.randomUUID());
        const sessionId = SessionId(globalThis.crypto.randomUUID());
        const startedAt = new Date().toISOString();
        const existingTask = await this.ports.tasks.findById(taskId);
        const workspacePath = input.workspacePath
            ? normalizeWorkspacePath(input.workspacePath)
            : undefined;
        const taskKind = input.taskKind ?? existingTask?.taskKind ?? "primary";
        const runtimeSource = input.runtimeSource ?? existingTask?.runtimeSource;
        const task = await this.ports.tasks.upsert({
            id: taskId,
            title: input.title,
            slug: createTaskSlug({ title: input.title }),
            status: "running",
            taskKind,
            createdAt: existingTask?.createdAt ?? startedAt,
            updatedAt: startedAt,
            lastSessionStartedAt: startedAt,
            ...(input.parentTaskId ?? existingTask?.parentTaskId
                ? {
                    parentTaskId: input.parentTaskId ?? existingTask!.parentTaskId,
                }
                : {}),
            ...(input.parentSessionId ?? existingTask?.parentSessionId
                ? {
                    parentSessionId: input.parentSessionId ?? existingTask!.parentSessionId,
                }
                : {}),
            ...(input.backgroundTaskId ?? existingTask?.backgroundTaskId
                ? {
                    backgroundTaskId: input.backgroundTaskId ?? existingTask!.backgroundTaskId,
                }
                : {}),
            ...(workspacePath ? { workspacePath } : {}),
            ...(runtimeSource ? { runtimeSource } : {}),
        });
        const session = await this.ports.sessions.create({
            id: sessionId,
            taskId: task.id,
            status: "running",
            startedAt,
            ...(input.summary ? { summary: input.summary } : {}),
        });
        if (existingTask &&
            (existingTask.status !== "running" ||
                existingTask.runtimeSource !== task.runtimeSource)) {
            this.ports.notifier.publish({ type: "task.updated", payload: task });
        }
        this.ports.notifier.publish({ type: "task.started", payload: task });
        this.ports.notifier.publish({ type: "session.started", payload: session });
        if (!existingTask) {
            const startMeta = {
                ...(input.metadata ?? {}),
                taskKind: task.taskKind,
                ...(task.parentTaskId ? { parentTaskId: task.parentTaskId } : {}),
                ...(task.parentSessionId
                    ? { parentSessionId: task.parentSessionId }
                    : {}),
                ...(task.backgroundTaskId
                    ? { backgroundTaskId: task.backgroundTaskId }
                    : {}),
                ...(task.workspacePath
                    ? { workspacePath: task.workspacePath }
                    : {}),
                ...(runtimeSource ? { runtimeSource } : {}),
            };
            const event = await this.recorder.record({
                taskId: task.id,
                sessionId,
                kind: "task.start",
                title: input.title,
                metadata: startMeta,
                ...(input.summary ? { body: input.summary } : {}),
            });
            return {
                task,
                sessionId,
                events: [{ id: event.id, kind: event.kind }],
            };
        }
        return { task, sessionId, events: [] };
    }
    async completeTask(input: TaskCompletionInput): Promise<RecordedEventEnvelope> {
        return this.finishTask(input, "completed", "task.complete", input.summary);
    }
    async errorTask(input: TaskErrorInput): Promise<RecordedEventEnvelope> {
        return this.finishTask(input, "errored", "task.error", input.errorMessage);
    }
    async endSession(input: TaskSessionEndInput): Promise<{
        sessionId: MonitorSessionId;
        task: MonitoringTask;
    }> {
        const task = await this.requireTask(input.taskId);
        const runningCount = await this.ports.sessions.countRunningByTaskId(input.taskId);
        if (!input.sessionId && runningCount > 1) {
            throw new Error(`sessionId is required to end one of multiple running sessions for task: ${input.taskId}`);
        }
        const sessionId = await this.resolveSessionId(input.taskId, input.sessionId);
        if (!sessionId) {
            throw new Error(`No active session for task: ${input.taskId}`);
        }
        const endedAt = new Date().toISOString();
        const sessionBefore = await this.ports.sessions.findById(sessionId);
        await this.ports.sessions.updateStatus(sessionId, "completed", endedAt, input.summary);
        if (sessionBefore) {
            this.ports.notifier.publish({
                type: "session.ended",
                payload: { ...sessionBefore, status: "completed" as const, endedAt },
            });
        }
        await this.completeBgTasks(input.backgroundCompletions);
        const postRunning = await this.ports.sessions.countRunningByTaskId(task.id);
        const taskKind = task.taskKind ?? "primary";
        const hasRunningBackgroundDescendants = taskKind === "primary"
            ? await this.hasRunningBackgroundDescendants(task.id)
            : false;
        const meta = input.metadata ? { metadata: input.metadata } : {};
        if (shouldAutoCompleteBackground({
            taskKind,
            runningSessionCount: postRunning,
        }) &&
            task.status === "running") {
            const r = await this.completeTask({
                taskId: task.id,
                sessionId,
                summary: input.summary ?? "Background session completed",
                ...meta,
            });
            return { sessionId, task: r.task };
        }
        if (shouldAutoCompletePrimary({
            taskKind,
            completeTask: input.completeTask ?? false,
            runningSessionCount: postRunning,
            completionReason: input.completionReason,
            hasRunningBackgroundDescendants,
        }) &&
            (task.status === "running" || task.status === "waiting")) {
            const r = await this.completeTask({
                taskId: task.id,
                sessionId,
                summary: input.summary ?? "Session ended",
                ...meta,
            });
            return { sessionId, task: r.task };
        }
        if (shouldMovePrimaryToWaiting({
            taskKind,
            completeTask: input.completeTask ?? false,
            runningSessionCount: postRunning,
            completionReason: input.completionReason,
            hasRunningBackgroundDescendants,
        }) &&
            task.status === "running") {
            const waitingTask = await this.setTaskStatus(task.id, "waiting");
            return { sessionId, task: waitingTask };
        }
        return { sessionId, task: await this.requireTask(task.id) };
    }
    async ensureRuntimeSession(input: RuntimeSessionEnsureInput): Promise<RuntimeSessionEnsureResult> {
        const workspacePath = input.workspacePath
            ? normalizeWorkspacePath(input.workspacePath)
            : undefined;
        const binding = await this.ports.runtimeBindings.find(input.runtimeSource, input.runtimeSessionId);
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
            const sessionId = SessionId(globalThis.crypto.randomUUID());
            const startedAt = new Date().toISOString();
            const task = await this.ports.tasks.findById(existingTaskId);
            if (task &&
                (task.status !== "running" ||
                    task.runtimeSource !== input.runtimeSource)) {
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
        const result = await this.startTask({
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
    async endRuntimeSession(input: RuntimeSessionEndInput): Promise<void> {
        const binding = await this.ports.runtimeBindings.find(input.runtimeSource, input.runtimeSessionId);
        if (!binding) {
            if (input.completeTask === true) {
                const taskId = await this.ports.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
                if (taskId) {
                    await this.completeTaskIfIncomplete({
                        taskId,
                        summary: input.summary ?? "Runtime session ended",
                    });
                    await this.ports.runtimeBindings.delete(input.runtimeSource, input.runtimeSessionId);
                }
            }
            return;
        }
        const session = await this.ports.sessions.findById(binding.monitorSessionId);
        if (!session || session.status !== "running") {
            return;
        }
        const endedAtRt = new Date().toISOString();
        await this.ports.sessions.updateStatus(binding.monitorSessionId, "completed", endedAtRt, input.summary);
        this.ports.notifier.publish({
            type: "session.ended",
            payload: { ...session, status: "completed" as const, endedAt: endedAtRt },
        });
        await this.ports.runtimeBindings.clearSession(input.runtimeSource, input.runtimeSessionId);
        await this.completeBgTasks(input.backgroundCompletions);
        const task = await this.ports.tasks.findById(binding.taskId);
        const hasRunningBackgroundDescendants = task?.taskKind === "primary"
            ? await this.hasRunningBackgroundDescendants(binding.taskId)
            : false;
        if (input.completeTask === true && task) {
            if (shouldAutoCompletePrimary({
                taskKind: task.taskKind ?? "primary",
                completeTask: true,
                runningSessionCount: await this.ports.sessions.countRunningByTaskId(binding.taskId),
                completionReason: input.completionReason,
                hasRunningBackgroundDescendants,
            })) {
                await this.completeTaskIfIncomplete({
                    taskId: binding.taskId,
                    sessionId: binding.monitorSessionId,
                    summary: input.summary ?? "Runtime session ended",
                });
            }
        }
        else if (task?.taskKind === "background" &&
            task.status === "running" &&
            (await this.ports.sessions.countRunningByTaskId(binding.taskId)) === 0) {
            await this.completeTaskIfIncomplete({
                taskId: binding.taskId,
                sessionId: binding.monitorSessionId,
                summary: input.summary ?? "Background task completed",
            });
        }
        else if (task &&
            shouldMovePrimaryToWaiting({
                taskKind: task.taskKind ?? "primary",
                completeTask: input.completeTask ?? false,
                runningSessionCount: await this.ports.sessions.countRunningByTaskId(binding.taskId),
                completionReason: input.completionReason,
                hasRunningBackgroundDescendants,
            })) {
            await this.setTaskStatus(binding.taskId, "waiting");
        }
    }
    async linkTask(input: TaskLinkInput): Promise<MonitoringTask> {
        const task = await this.requireTask(input.taskId);
        const t = input.title?.trim();
        const updated = await this.ports.tasks.upsert({
            ...task,
            taskKind: input.taskKind ?? task.taskKind ?? "primary",
            ...(t ? { title: t, slug: createTaskSlug({ title: t }) } : {}),
            ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
            ...(input.parentSessionId
                ? { parentSessionId: input.parentSessionId }
                : {}),
            ...(input.backgroundTaskId
                ? { backgroundTaskId: input.backgroundTaskId }
                : {}),
            updatedAt: new Date().toISOString(),
        });
        this.ports.notifier.publish({ type: "task.updated", payload: updated });
        return updated;
    }
    async deleteTask(taskId: MonitorTaskId): Promise<"deleted" | "not_found"> {
        if (!(await this.ports.tasks.findById(taskId))) {
            return "not_found";
        }
        const result = await this.ports.tasks.delete(taskId);
        for (const id of result.deletedIds) {
            this.ports.notifier.publish({
                type: "task.deleted",
                payload: { taskId: id },
            });
        }
        return "deleted";
    }
    async deleteFinishedTasks(): Promise<number> {
        const count = await this.ports.tasks.deleteFinished();
        this.ports.notifier.publish({
            type: "tasks.purged",
            payload: { count },
        });
        return count;
    }
    async renameTask(input: TaskRenameInput): Promise<MonitoringTask | null> {
        const task = await this.ports.tasks.findById(input.taskId);
        if (!task) {
            return null;
        }
        const nextTitle = input.title.trim();
        if (nextTitle === task.title) {
            return task;
        }
        await this.ports.tasks.updateTitle(input.taskId, nextTitle, createTaskSlug({ title: nextTitle }), new Date().toISOString());
        const updated = await this.ports.tasks.findById(input.taskId);
        if (updated) {
            this.ports.notifier.publish({
                type: "task.updated",
                payload: updated,
            });
        }
        return updated ?? null;
    }
    async updateTask(input: TaskPatchInput): Promise<MonitoringTask | null> {
        const task = await this.ports.tasks.findById(input.taskId);
        if (!task) {
            return null;
        }
        const titleUpdate = input.title !== undefined ? input.title.trim() : undefined;
        const hasNewTitle = titleUpdate !== undefined && titleUpdate !== task.title;
        const hasNewStatus = input.status !== undefined && input.status !== task.status;
        if (!hasNewTitle && !hasNewStatus) {
            return task;
        }
        const updated = await this.ports.tasks.upsert({
            ...task,
            taskKind: task.taskKind ?? "primary",
            ...(hasNewTitle
                ? { title: titleUpdate, slug: createTaskSlug({ title: titleUpdate }) }
                : {}),
            ...(hasNewStatus
                ? { status: input.status }
                : {}),
            updatedAt: new Date().toISOString(),
        });
        this.ports.notifier.publish({ type: "task.updated", payload: updated });
        return updated;
    }
    async requireTask(taskId: MonitorTaskId): Promise<MonitoringTask> {
        const task = await this.ports.tasks.findById(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        return task;
    }
    private async setTaskStatus(taskId: MonitorTaskId, status: MonitoringTask["status"]): Promise<MonitoringTask> {
        const updatedAt = new Date().toISOString();
        await this.ports.tasks.updateStatus(taskId, status, updatedAt);
        const task = await this.requireTask(taskId);
        this.ports.notifier.publish({ type: "task.updated", payload: task });
        return task;
    }
    private async completeTaskIfIncomplete(input: TaskCompletionInput): Promise<void> {
        const task = await this.ports.tasks.findById(input.taskId);
        if (!task ||
            task.status === "completed" ||
            task.status === "errored") {
            return;
        }
        await this.completeTask(input);
    }
    private async resolveSessionId(taskId: MonitorTaskId, sessionId?: MonitorSessionId): Promise<MonitorSessionId | undefined> {
        if (sessionId) {
            return sessionId;
        }
        return (await this.ports.sessions.findActiveByTaskId(taskId))?.id;
    }
    private async hasRunningBackgroundDescendants(taskId: MonitorTaskId): Promise<boolean> {
        const stack = [taskId];
        while (stack.length > 0) {
            const parentId = stack.pop();
            if (!parentId) {
                continue;
            }
            const children = await this.ports.tasks.findChildren(parentId);
            for (const child of children) {
                if (child.taskKind === "background" && child.status === "running") {
                    return true;
                }
                stack.push(child.id);
            }
        }
        return false;
    }
    private async completeBgTasks(ids?: readonly MonitorTaskId[]): Promise<void> {
        if (!ids?.length) {
            return;
        }
        for (const bgTaskId of ids) {
            const bgTask = await this.ports.tasks.findById(bgTaskId);
            if (bgTask?.status === "running") {
                await this.completeTask({
                    taskId: bgTask.id,
                    summary: "Background task completed",
                });
            }
        }
    }
    private async finishTask(input: TaskCompletionInput, status: "completed" | "errored", kind: MonitoringEventKind, body?: string): Promise<RecordedEventEnvelope> {
        const task = await this.requireTask(input.taskId);
        const endedAt = new Date().toISOString();
        const sessionId = await this.resolveSessionId(input.taskId, input.sessionId);
        if (sessionId) {
            const sOld = await this.ports.sessions.findById(sessionId);
            await this.ports.sessions.updateStatus(sessionId, status, endedAt, input.summary);
            if (sOld) {
                this.ports.notifier.publish({
                    type: "session.ended",
                    payload: { ...sOld, status, endedAt },
                });
            }
        }
        if (task.status === status) {
            return { task, ...this.withSessionId(sessionId), events: [] };
        }
        await this.ports.tasks.updateStatus(input.taskId, status, endedAt);
        const finalTask = (await this.ports.tasks.findById(input.taskId)) ?? task;
        this.ports.notifier.publish(status === "completed"
            ? { type: "task.completed", payload: finalTask }
            : { type: "task.updated", payload: finalTask });
        const event = await this.recorder.record({
            taskId: input.taskId,
            kind,
            title: status === "completed" ? "Task completed" : "Task errored",
            ...this.withSessionId(sessionId),
            ...(body ? { body } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
        });
        return {
            task: finalTask,
            ...this.withSessionId(sessionId),
            events: [{ id: event.id, kind: event.kind }],
        };
    }
    private withSessionId(sessionId?: MonitorSessionId): {
        sessionId?: MonitorSessionId;
    } {
        return sessionId ? { sessionId } : {};
    }
}
