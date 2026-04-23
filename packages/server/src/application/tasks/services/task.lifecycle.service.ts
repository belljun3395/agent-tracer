import { createTaskSlug, normalizeWorkspacePath, type MonitoringEventKind } from "~domain/index.js";
import { mapTimelineEventToRecord } from "~application/views/index.js";
import type { MonitorPorts } from "~application/ports/index.js";
import { buildEventRecord } from "~application/events/event.recording.ops.js";
import type { TaskCompletionInput, TaskStartInput } from "~application/tasks/task.lifecycle.input.js";
import type { RecordedEventEnvelope } from "~application/tasks/task.lifecycle.result.js";

export async function finishTask(
    ports: MonitorPorts,
    input: TaskCompletionInput,
    status: "completed" | "errored",
    kind: MonitoringEventKind,
    body?: string,
): Promise<RecordedEventEnvelope> {
    const task = await ports.tasks.findById(input.taskId);
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    const endedAt = new Date().toISOString();
    const sessionId = input.sessionId ?? (await ports.sessions.findActiveByTaskId(input.taskId))?.id;
    if (sessionId) {
        const sOld = await ports.sessions.findById(sessionId);
        await ports.sessions.updateStatus(sessionId, status, endedAt, input.summary);
        if (sOld) {
            ports.notifier.publish({ type: "session.ended", payload: { ...sOld, status, endedAt } });
        }
    }
    if (task.status === status) {
        return { task, ...(sessionId ? { sessionId } : {}), events: [] };
    }
    await ports.tasks.updateStatus(input.taskId, status, endedAt);
    const finalTask = (await ports.tasks.findById(input.taskId)) ?? task;
    ports.notifier.publish(
        status === "completed"
            ? { type: "task.completed", payload: finalTask }
            : { type: "task.updated", payload: finalTask },
    );
    const record = buildEventRecord({
        taskId: input.taskId,
        kind,
        lane: "user",
        title: status === "completed" ? "Task completed" : "Task errored",
        ...(sessionId ? { sessionId } : {}),
        ...(body ? { body } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
    });
    const event = await ports.events.insert({ id: globalThis.crypto.randomUUID(), ...record });
    ports.notifier.publish({ type: "event.logged", payload: mapTimelineEventToRecord(event) });
    return { task: finalTask, ...(sessionId ? { sessionId } : {}), events: [{ id: event.id, kind: event.kind }] };
}

export async function startTask(ports: MonitorPorts, input: TaskStartInput): Promise<RecordedEventEnvelope> {
    const taskId = input.taskId ?? globalThis.crypto.randomUUID();
    const sessionId = globalThis.crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const existingTask = await ports.tasks.findById(taskId);
    const workspacePath = input.workspacePath ? normalizeWorkspacePath(input.workspacePath) : undefined;
    const taskKind = input.taskKind ?? existingTask?.taskKind ?? "primary";
    const runtimeSource = input.runtimeSource ?? existingTask?.runtimeSource;
    const task = await ports.tasks.upsert({
        id: taskId,
        title: input.title,
        slug: createTaskSlug({ title: input.title }),
        status: "running",
        taskKind,
        createdAt: existingTask?.createdAt ?? startedAt,
        updatedAt: startedAt,
        lastSessionStartedAt: startedAt,
        ...(input.parentTaskId ?? existingTask?.parentTaskId ? { parentTaskId: input.parentTaskId ?? existingTask!.parentTaskId } : {}),
        ...(input.parentSessionId ?? existingTask?.parentSessionId ? { parentSessionId: input.parentSessionId ?? existingTask!.parentSessionId } : {}),
        ...(input.backgroundTaskId ?? existingTask?.backgroundTaskId ? { backgroundTaskId: input.backgroundTaskId ?? existingTask!.backgroundTaskId } : {}),
        ...(workspacePath ? { workspacePath } : {}),
        ...(runtimeSource ? { runtimeSource } : {}),
    });
    const session = await ports.sessions.create({
        id: sessionId,
        taskId: task.id,
        status: "running",
        startedAt,
        ...(input.summary ? { summary: input.summary } : {}),
    });
    if (existingTask && (existingTask.status !== "running" || existingTask.runtimeSource !== task.runtimeSource)) {
        ports.notifier.publish({ type: "task.updated", payload: task });
    }
    ports.notifier.publish({ type: "task.started", payload: task });
    ports.notifier.publish({ type: "session.started", payload: session });
    if (!existingTask) {
        const startMeta = {
            ...(input.metadata ?? {}),
            taskKind: task.taskKind,
            ...(task.parentTaskId ? { parentTaskId: task.parentTaskId } : {}),
            ...(task.parentSessionId ? { parentSessionId: task.parentSessionId } : {}),
            ...(task.backgroundTaskId ? { backgroundTaskId: task.backgroundTaskId } : {}),
            ...(task.workspacePath ? { workspacePath: task.workspacePath } : {}),
            ...(runtimeSource ? { runtimeSource } : {}),
        };
        const record = buildEventRecord({
            taskId: task.id,
            sessionId,
            kind: "task.start",
            lane: "user",
            title: input.title,
            metadata: startMeta,
            ...(input.summary ? { body: input.summary } : {}),
        });
        const event = await ports.events.insert({ id: globalThis.crypto.randomUUID(), ...record });
        ports.notifier.publish({ type: "event.logged", payload: mapTimelineEventToRecord(event) });
        return { task, sessionId, events: [{ id: event.id, kind: event.kind }] };
    }
    return { task, sessionId, events: [] };
}
