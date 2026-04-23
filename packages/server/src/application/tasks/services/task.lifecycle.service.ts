import { createTaskSlug, normalizeWorkspacePath } from "~domain/index.js";
import { mapTimelineEventToRecord } from "~application/views/index.js";
import type {
    IEventRepository,
    INotificationPublisher,
    ISessionRepository,
    ITaskRepository,
} from "~application/ports/index.js";
import { buildEventRecord } from "~application/events/event.recording.ops.js";
import type { TaskFinalizationInput, TaskStartInput } from "~application/tasks/task.lifecycle.input.js";
import type { RecordedEventEnvelope } from "~application/tasks/task.lifecycle.result.js";

export class TaskLifecycleService {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly sessions: ISessionRepository,
        private readonly events: IEventRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async finalizeTask(input: TaskFinalizationInput): Promise<RecordedEventEnvelope> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new Error(`Task not found: ${input.taskId}`);

        const endedAt = new Date().toISOString();
        const sessionId = input.sessionId ?? (await this.sessions.findActiveByTaskId(input.taskId))?.id;
        const status = input.outcome;
        if (sessionId) {
            const previousSession = await this.sessions.findById(sessionId);
            await this.sessions.updateStatus(sessionId, status, endedAt, input.summary);
            if (previousSession) {
                this.notifier.publish({
                    type: "session.ended",
                    payload: { ...previousSession, status, endedAt },
                });
            }
        }

        if (task.status === status) {
            return { task, ...(sessionId ? { sessionId } : {}), events: [] };
        }

        await this.tasks.updateStatus(input.taskId, status, endedAt);
        const finalTask = (await this.tasks.findById(input.taskId)) ?? task;
        this.notifier.publish(
            status === "completed"
                ? { type: "task.completed", payload: finalTask }
                : { type: "task.updated", payload: finalTask },
        );

        const body = this.finalizationBody(input);
        const record = buildEventRecord({
            taskId: input.taskId,
            kind: status === "completed" ? "task.complete" : "task.error",
            lane: "user",
            title: status === "completed" ? "Task completed" : "Task errored",
            ...(sessionId ? { sessionId } : {}),
            ...(body ? { body } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
        });
        const event = await this.events.insert({ id: globalThis.crypto.randomUUID(), ...record });
        this.notifier.publish({ type: "event.logged", payload: mapTimelineEventToRecord(event) });
        return { task: finalTask, ...(sessionId ? { sessionId } : {}), events: [{ id: event.id, kind: event.kind }] };
    }

    async startTask(input: TaskStartInput): Promise<RecordedEventEnvelope> {
        const taskId = input.taskId ?? globalThis.crypto.randomUUID();
        const sessionId = globalThis.crypto.randomUUID();
        const startedAt = new Date().toISOString();
        const existingTask = await this.tasks.findById(taskId);
        const workspacePath = input.workspacePath ? normalizeWorkspacePath(input.workspacePath) : undefined;
        const taskKind = input.taskKind ?? existingTask?.taskKind ?? "primary";
        const runtimeSource = input.runtimeSource ?? existingTask?.runtimeSource;
        const task = await this.tasks.upsert({
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
        const session = await this.sessions.create({
            id: sessionId,
            taskId: task.id,
            status: "running",
            startedAt,
            ...(input.summary ? { summary: input.summary } : {}),
        });
        if (existingTask && (existingTask.status !== "running" || existingTask.runtimeSource !== task.runtimeSource)) {
            this.notifier.publish({ type: "task.updated", payload: task });
        }
        this.notifier.publish({ type: "task.started", payload: task });
        this.notifier.publish({ type: "session.started", payload: session });
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
            const event = await this.events.insert({ id: globalThis.crypto.randomUUID(), ...record });
            this.notifier.publish({ type: "event.logged", payload: mapTimelineEventToRecord(event) });
            return { task, sessionId, events: [{ id: event.id, kind: event.kind }] };
        }
        return { task, sessionId, events: [] };
    }

    private finalizationBody(input: TaskFinalizationInput): string | undefined {
        return input.outcome === "errored"
            ? input.errorMessage
            : input.summary;
    }
}
