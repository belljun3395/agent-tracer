import { Inject, Injectable } from "@nestjs/common";
import type { MonitoringTask } from "~task/domain/task.model.js";
import type { MonitoringEventKind } from "~event/public/types/event.types.js";
import type { MonitoringTaskKind } from "~task/common/task.status.type.js";
import { createEventRecordDraft } from "~event/public/helpers.js";
import { TaskUpsertDraft } from "../domain/task.upsert.draft.model.js";
import {
    TaskFinalizationRecording,
    TaskStartRecording,
} from "../domain/task.event.recording.model.js";
import { TaskNotFoundError } from "../common/task.errors.js";
import { TaskQueryService } from "./task.query.service.js";
import { TaskManagementService } from "./task.management.service.js";
import {
    EVENT_PROJECTION_ACCESS_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    SESSION_ACCESS_PORT,
    TIMELINE_EVENT_ACCESS_PORT,
} from "../application/outbound/tokens.js";
import type { ISessionAccess } from "../application/outbound/session.access.port.js";
import type { ITimelineEventAccess } from "../application/outbound/timeline.event.access.port.js";
import type { IEventProjectionAccess } from "../application/outbound/event.projection.access.port.js";
import type { ITaskNotificationPublisher } from "../application/outbound/notification.publisher.port.js";

export interface StartTaskServiceInput {
    readonly taskId?: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
    readonly summary?: string;
    readonly taskKind?: MonitoringTaskKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface FinalizeTaskServiceInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
    readonly outcome: "completed" | "errored";
    readonly errorMessage?: string;
}

export interface TaskLifecycleEventRef {
    readonly id: string;
    readonly kind: MonitoringEventKind;
}

export interface TaskLifecycleResult {
    readonly task: MonitoringTask;
    readonly sessionId?: string;
    readonly events: readonly TaskLifecycleEventRef[];
}

@Injectable()
export class TaskLifecycleService {
    constructor(
        private readonly query: TaskQueryService,
        private readonly management: TaskManagementService,
        @Inject(SESSION_ACCESS_PORT) private readonly sessions: ISessionAccess,
        @Inject(TIMELINE_EVENT_ACCESS_PORT) private readonly events: ITimelineEventAccess,
        @Inject(EVENT_PROJECTION_ACCESS_PORT) private readonly projection: IEventProjectionAccess,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: ITaskNotificationPublisher,
    ) {}

    async startTask(input: StartTaskServiceInput): Promise<TaskLifecycleResult> {
        const taskId = input.taskId ?? globalThis.crypto.randomUUID();
        const sessionId = globalThis.crypto.randomUUID();
        const startedAt = new Date().toISOString();
        const existingTask = await this.query.findById(taskId);

        const draft = TaskUpsertDraft.from({
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
        const task = await this.management.upsertFromDraft(draft.toShape());

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
            const recording = new TaskStartRecording({
                task,
                sessionId,
                title: input.title,
                ...(task.runtimeSource ? { runtimeSource: task.runtimeSource } : {}),
                ...(input.summary ? { summary: input.summary } : {}),
                ...(input.metadata ? { metadata: input.metadata } : {}),
            });
            const record = createEventRecordDraft(recording.toEventRecordingInput());
            const event = await this.events.insert({
                id: globalThis.crypto.randomUUID(),
                ...record,
            } as never);
            this.notifier.publish({ type: "event.logged", payload: this.projection.project(event as never) as never });
            return { task, sessionId, events: [{ id: event.id, kind: event.kind as MonitoringEventKind }] };
        }
        return { task, sessionId, events: [] };
    }

    async finalizeTask(input: FinalizeTaskServiceInput): Promise<TaskLifecycleResult> {
        const task = await this.query.findById(input.taskId);
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

        await this.management.updateStatus(input.taskId, status, endedAt);
        const finalTask = (await this.query.findById(input.taskId)) ?? task;
        this.notifier.publish(
            status === "completed"
                ? { type: "task.completed", payload: finalTask }
                : { type: "task.updated", payload: finalTask },
        );

        const recording = new TaskFinalizationRecording({
            taskId: input.taskId,
            ...(sessionId ? { sessionId } : {}),
            outcome: status,
            ...(input.summary ? { summary: input.summary } : {}),
            ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
        });
        const record = createEventRecordDraft(recording.toEventRecordingInput());
        const event = await this.events.insert({
            id: globalThis.crypto.randomUUID(),
            ...record,
        } as never);
        this.notifier.publish({ type: "event.logged", payload: this.projection.project(event as never) as never });
        return { task: finalTask, ...(sessionId ? { sessionId } : {}), events: [{ id: event.id, kind: event.kind as MonitoringEventKind }] };
    }
}
