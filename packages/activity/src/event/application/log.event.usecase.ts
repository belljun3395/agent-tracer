import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional, runOnTransactionCommit } from "typeorm-transactional";
import { KIND } from "@monitor/activity/event/domain/common/const/event.kind.const.js";
import { createEventRecordDraft, normalizeFilePaths } from "@monitor/activity/event/domain/event.recording.js";
import { deriveFileChangeEventInputs, shouldApplyLoggedEventTaskStatusEffect } from "@monitor/activity/event/domain/event.recording.js";
import type { TimelineEvent } from "@monitor/activity/event/domain/model/timeline.event.model.js";
import { TimelineEventService } from "../service/timeline.event.service.js";
import { projectTimelineEvent } from "../domain/timeline.event.projection.model.js";
import { CrossCheckDedupeCache } from "./cross.check.dedupe.cache.js";
import {
    CLOCK_PORT,
    ID_GENERATOR_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    TASK_ACCESS_PORT,
    VERIFICATION_POST_PROCESSOR_PORT,
} from "./outbound/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IIdGenerator } from "./outbound/id.generator.port.js";
import type { IEventNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type { IVerificationPostProcessor } from "./outbound/verification.post.processor.port.js";
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
        @Inject(VERIFICATION_POST_PROCESSOR_PORT) private readonly verification: IVerificationPostProcessor,
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
                        task,
                        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
                        events: [{ id: existingId, kind: input.kind }],
                    };
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

        const desiredStatus = input.taskEffects?.taskStatus;
        if (
            desiredStatus !== undefined &&
            shouldApplyLoggedEventTaskStatusEffect({ currentStatus: task.status, desiredStatus })
        ) {
            const updatedAt = this.clock.nowIso();
            await this.tasks.updateStatus(task.id, desiredStatus, updatedAt);
            const updatedTask = await this.tasks.findById(task.id);
            if (updatedTask) {
                // Defer until the transaction commits so a rollback can't leave
                // dashboards showing a status change that never persisted.
                runOnTransactionCommit(() => {
                    this.notifier.publish({ type: NOTIFICATION_TYPE.taskUpdated, payload: updatedTask });
                });
                return { task: updatedTask, ...(sessionId ? { sessionId } : {}), events: allEvents };
            }
        }

        return { task, ...(sessionId ? { sessionId } : {}), events: allEvents };
    }

    private async insertEvent(input: EventRecordingInput): Promise<TimelineEvent> {
        const record = createEventRecordDraft(input);
        const event = await this.events.insert({
            id: this.idGen.newUuid(),
            ...record,
        });
        // Broadcast only after the surrounding transaction commits, so a
        // rolled-back event never reaches dashboards as a phantom row.
        runOnTransactionCommit(() => {
            this.notifier.publish({ type: NOTIFICATION_TYPE.eventLogged, payload: projectTimelineEvent(event) });
        });

        // 후처리(턴 개폐 + 룰 평가 + enforcement)를 같은 요청 트랜잭션 안에서 동기 실행한다.
        // 실패하면 이벤트 insert도 함께 롤백된다.
        if (event.kind === KIND.userMessage) {
            await this.verification.onUserMessage(event);
        } else if (event.kind === KIND.assistantResponse) {
            await this.verification.onAssistantResponse(event);
        } else {
            await this.verification.onOtherEvent(event);
        }

        return event;
    }
}
