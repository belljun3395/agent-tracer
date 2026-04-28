import { Inject, Injectable } from "@nestjs/common";
import { KIND } from "~event/domain/common/const/event.kind.const.js";
import { createEventRecordDraft, normalizeFilePaths } from "~event/domain/event.recording.js";
import { deriveFileChangeEventInputs, shouldApplyLoggedEventTaskStatusEffect } from "~event/domain/event.recording.js";
import type { TimelineEvent } from "~event/domain/model/timeline.event.model.js";
import { TimelineEventService } from "../service/timeline.event.service.js";
import { projectTimelineEvent } from "../domain/timeline.event.projection.model.js";
import {
    NOTIFICATION_PUBLISHER_PORT,
    TASK_ACCESS_PORT,
    VERIFICATION_POST_PROCESSOR_PORT,
} from "./outbound/tokens.js";
import type { IEventNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type { IEventTaskAccess } from "./outbound/task.access.port.js";
import type { IVerificationPostProcessor } from "./outbound/verification.post.processor.port.js";
import type { LogEventUseCaseIn, LogEventUseCaseOut } from "./dto/log.event.usecase.dto.js";

class TaskNotFoundError extends Error {
    constructor(taskId: string) {
        super(`Task not found: ${taskId}`);
        this.name = "TaskNotFoundError";
    }
}

type EventRecordingInput = Parameters<typeof createEventRecordDraft>[0];

@Injectable()
export class LogEventUseCase {
    constructor(
        private readonly events: TimelineEventService,
        @Inject(TASK_ACCESS_PORT) private readonly tasks: IEventTaskAccess,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: IEventNotificationPublisher,
        @Inject(VERIFICATION_POST_PROCESSOR_PORT) private readonly verification: IVerificationPostProcessor,
    ) {}

    async execute(input: LogEventUseCaseIn): Promise<LogEventUseCaseOut> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);

        const filePaths = normalizeFilePaths(input.filePaths);
        const primaryEvent = await this.insertEvent({
            taskId: input.taskId,
            kind: input.kind,
            lane: input.lane,
            ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.body !== undefined ? { body: input.body } : {}),
            ...(filePaths.length > 0 ? { filePaths } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            ...(input.parentEventId !== undefined ? { parentEventId: input.parentEventId } : {}),
            ...(input.relatedEventIds !== undefined ? { relatedEventIds: input.relatedEventIds } : {}),
            ...(input.relationType !== undefined ? { relationType: input.relationType } : {}),
            ...(input.relationLabel !== undefined ? { relationLabel: input.relationLabel } : {}),
            ...(input.relationExplanation !== undefined ? { relationExplanation: input.relationExplanation } : {}),
            ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
        });

        const derivedEvents: TimelineEvent[] = [];
        for (const eventInput of deriveFileChangeEventInputs({
            sourceEvent: primaryEvent,
            filePaths,
            ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        })) {
            derivedEvents.push(await this.insertEvent(eventInput));
        }

        const allEvents = [primaryEvent, ...derivedEvents].map((e) => ({ id: e.id, kind: e.kind }));
        const sessionId = input.sessionId;

        const desiredStatus = input.taskEffects?.taskStatus as IEventTaskAccess extends never ? never : ("running" | "waiting" | "completed" | "errored" | undefined);
        if (
            desiredStatus !== undefined &&
            shouldApplyLoggedEventTaskStatusEffect({ currentStatus: task.status, desiredStatus })
        ) {
            const updatedAt = new Date().toISOString();
            await this.tasks.updateStatus(task.id, desiredStatus, updatedAt);
            const updatedTask = await this.tasks.findById(task.id);
            if (updatedTask) {
                this.notifier.publish({ type: "task.updated", payload: updatedTask as never });
                return { task: updatedTask as never, ...(sessionId ? { sessionId } : {}), events: allEvents } as LogEventUseCaseOut;
            }
        }

        return { task: task as never, ...(sessionId ? { sessionId } : {}), events: allEvents } as LogEventUseCaseOut;
    }

    private async insertEvent(input: EventRecordingInput): Promise<TimelineEvent> {
        const record = createEventRecordDraft(input);
        const persisted = await this.events.insert({
            id: globalThis.crypto.randomUUID(),
            ...record,
        } as never);
        const event = persisted as unknown as TimelineEvent;
        this.notifier.publish({ type: "event.logged", payload: projectTimelineEvent(event) as never });

        try {
            if (event.kind === KIND.userMessage) {
                await this.verification.onUserMessage(event as never);
            } else if (event.kind === KIND.assistantResponse) {
                await this.verification.onAssistantResponse(event as never);
            } else {
                await this.verification.onOtherEvent(event as never);
            }
        } catch (err) {
            console.error("[verification] post-processor failed for event", event.id, err);
        }

        return event;
    }
}
