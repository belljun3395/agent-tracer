import { Inject, Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { KIND } from "~activity/event/domain/common/const/event.kind.const.js";
import { createEventRecordDraft, normalizeFilePaths } from "~activity/event/domain/event.recording.js";
import { deriveFileChangeEventInputs, shouldApplyLoggedEventTaskStatusEffect } from "~activity/event/domain/event.recording.js";
import type { TimelineEvent } from "~activity/event/domain/model/timeline.event.model.js";
import { TimelineEventService } from "../service/timeline.event.service.js";
import { projectTimelineEvent } from "../domain/timeline.event.projection.model.js";
import { CrossCheckDedupeCache } from "./cross.check.dedupe.cache.js";
import {
    CLOCK_PORT,
    ID_GENERATOR_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    POST_PROCESSING_QUEUE_PORT,
    TASK_ACCESS_PORT,
} from "./outbound/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IIdGenerator } from "./outbound/id.generator.port.js";
import type { IEventNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type {
    IPostProcessingQueue,
    PostProcessingJobType,
} from "./outbound/post.processing.queue.port.js";
import type { IEventTaskAccess } from "./outbound/task.access.port.js";
import type { LogEventUseCaseIn, LogEventUseCaseOut } from "./dto/log.event.usecase.dto.js";

interface CrossCheckMarker {
    readonly source: "hook" | "rollout";
    readonly dedupeKey: string;
}

function readCrossCheckMarker(metadata: Record<string, unknown> | undefined): CrossCheckMarker | undefined {
    const raw = metadata?.["crossCheck"];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const record = raw as Record<string, unknown>;
    const source = record["source"];
    const dedupeKey = record["dedupeKey"];
    if (typeof dedupeKey !== "string" || !dedupeKey) return undefined;
    if (source !== "hook" && source !== "rollout") return undefined;
    return { source, dedupeKey };
}

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
        @Inject(POST_PROCESSING_QUEUE_PORT) private readonly queue: IPostProcessingQueue,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
        private readonly dedupe: CrossCheckDedupeCache,
    ) {}

    @Transactional()
    async execute(input: LogEventUseCaseIn): Promise<LogEventUseCaseOut> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);

        // Cross-check between Codex hook + rollout: if both emit the same
        // logical event within the dedupe TTL, merge metadata into the first
        // one rather than inserting a duplicate row.
        const marker = readCrossCheckMarker(input.metadata);
        if (marker) {
            const existingId = this.dedupe.lookup(input.kind, input.sessionId, marker.dedupeKey);
            if (existingId) {
                const merged = await this.events.updateMetadata(existingId, {
                    ...(input.metadata ?? {}),
                    crossCheck: { ...marker, mergedFrom: marker.source, merged: true },
                });
                if (merged) {
                    return {
                        task: task as never,
                        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
                        events: [{ id: existingId, kind: input.kind }],
                    } as LogEventUseCaseOut;
                }
            }
        }

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

        if (marker) {
            this.dedupe.remember(input.kind, sessionId, marker.dedupeKey, primaryEvent.id);
        }

        const desiredStatus = input.taskEffects?.taskStatus as IEventTaskAccess extends never ? never : ("running" | "waiting" | "completed" | "errored" | undefined);
        if (
            desiredStatus !== undefined &&
            shouldApplyLoggedEventTaskStatusEffect({ currentStatus: task.status, desiredStatus })
        ) {
            const updatedAt = this.clock.nowIso();
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
            id: this.idGen.newUuid(),
            ...record,
        } as never);
        const event = persisted as unknown as TimelineEvent;
        this.notifier.publish({ type: "event.logged", payload: projectTimelineEvent(event) as never });

        const jobType: PostProcessingJobType =
            event.kind === KIND.userMessage
                ? "verification.user_message"
                : event.kind === KIND.assistantResponse
                    ? "verification.assistant_response"
                    : "verification.other_event";
        // Enqueue participates in the surrounding @Transactional() — outbox-style.
        // A failure here MUST roll back the event insert so we never lose post-processing
        // for an event that was committed.
        await this.queue.enqueue({ eventId: event.id, jobType });

        return event;
    }
}
