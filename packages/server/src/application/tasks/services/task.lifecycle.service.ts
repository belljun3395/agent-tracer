import {
    createEventRecordDraft,
} from "~domain/monitoring/index.js";
import {
    createTaskUpsertDraft,
    toTaskFinalizationEventRecordingInput,
    toTaskStartEventRecordingInput,
} from "~domain/monitoring/index.js";
import { projectTimelineEvent } from "~application/events/timeline-event.projection.js";
import type {
    IEventRepository,
    INotificationPublisher,
    ISessionRepository,
    ITaskRepository,
} from "~application/ports/index.js";
import type {
    FinalizeTaskServiceInput,
    StartTaskServiceInput,
    TaskLifecycleServiceResult,
} from "./task.lifecycle.service.dto.js";
import { TaskNotFoundError } from "../common/task.errors.js";

export class TaskLifecycleService {
    constructor(
        private readonly tasks: ITaskRepository,
        private readonly sessions: ISessionRepository,
        private readonly events: IEventRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async finalizeTask(input: FinalizeTaskServiceInput): Promise<TaskLifecycleServiceResult> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);

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

        const record = createEventRecordDraft(toTaskFinalizationEventRecordingInput({
            taskId: input.taskId,
            ...(sessionId ? { sessionId } : {}),
            outcome: status,
            ...(input.summary ? { summary: input.summary } : {}),
            ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
        }));
        const event = await this.events.insert({ id: globalThis.crypto.randomUUID(), ...record });
        this.notifier.publish({ type: "event.logged", payload: projectTimelineEvent(event) });
        return { task: finalTask, ...(sessionId ? { sessionId } : {}), events: [{ id: event.id, kind: event.kind }] };
    }

    async startTask(input: StartTaskServiceInput): Promise<TaskLifecycleServiceResult> {
        const taskId = input.taskId ?? globalThis.crypto.randomUUID();
        const sessionId = globalThis.crypto.randomUUID();
        const startedAt = new Date().toISOString();
        const existingTask = await this.tasks.findById(taskId);
        const taskDraft = createTaskUpsertDraft({
            taskId,
            title: input.title,
            startedAt,
            ...(existingTask ? { existingTask } : {}),
            ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
            ...(input.runtimeSource ? { runtimeSource: input.runtimeSource } : {}),
            ...(input.taskKind ? { taskKind: input.taskKind } : {}),
            ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
            ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
            ...(input.backgroundTaskId ? { backgroundTaskId: input.backgroundTaskId } : {}),
        });
        const task = await this.tasks.upsert(taskDraft);
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
            const record = createEventRecordDraft(toTaskStartEventRecordingInput({
                task,
                sessionId,
                title: input.title,
                ...(task.runtimeSource ? { runtimeSource: task.runtimeSource } : {}),
                ...(input.summary ? { summary: input.summary } : {}),
                ...(input.metadata ? { metadata: input.metadata } : {}),
            }));
            const event = await this.events.insert({ id: globalThis.crypto.randomUUID(), ...record });
            this.notifier.publish({ type: "event.logged", payload: projectTimelineEvent(event) });
            return { task, sessionId, events: [{ id: event.id, kind: event.kind }] };
        }
        return { task, sessionId, events: [] };
    }
}
