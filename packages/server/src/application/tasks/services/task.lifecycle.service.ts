import { createEventRecordDraft } from "~domain/monitoring/event/event.recording.js";
import { createTaskUpsertDraft, toTaskFinalizationEventRecordingInput, toTaskStartEventRecordingInput } from "~domain/monitoring/task/task.js";
import { projectTimelineEvent } from "~application/events/timeline-event.projection.js";
import type { NotificationPublisherPort } from "~application/ports/notifications/notification.publisher.port.js";
import type { TaskReadPort } from "~application/ports/tasks/task.read.port.js";
import type { TaskWritePort } from "~application/ports/tasks/task.write.port.js";
import type { TimelineEventWritePort } from "~application/ports/timeline-events/timeline.event.write.port.js";
import type { ISessionLifecycle } from "~session/public/iservice/session.lifecycle.iservice.js";
import type {
    FinalizeTaskServiceInput,
    StartTaskServiceInput,
    TaskLifecycleServiceResult,
} from "./task.lifecycle.service.dto.js";
import { TaskNotFoundError } from "../common/task.errors.js";

export class TaskLifecycleService {
    constructor(
        private readonly tasks: TaskReadPort & TaskWritePort,
        private readonly sessions: ISessionLifecycle,
        private readonly events: TimelineEventWritePort,
        private readonly notifier: NotificationPublisherPort,
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
