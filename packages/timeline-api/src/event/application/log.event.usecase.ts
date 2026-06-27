import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional, runOnTransactionCommit } from "typeorm-transactional";
import { createEventRecordDraft, normalizeFilePaths } from "@monitor/timeline-api/event/domain/event.recording.js";
import { deriveFileChangeEventInputs } from "@monitor/timeline-api/event/domain/event.recording.js";
import type { TimelineEvent } from "@monitor/timeline-api/event/domain/model/timeline.event.model.js";
import { TimelineEventService } from "../service/timeline.event.service.js";
import { projectTimelineEvent } from "../domain/timeline.event.projection.model.js";
import { CrossCheckDedupeCache } from "./cross.check.dedupe.cache.js";
import { ID_GENERATOR_PORT, NOTIFICATION_PUBLISHER_PORT } from "./outbound/tokens.js";
import type { IIdGenerator } from "./outbound/id.generator.port.js";
import type { IEventNotificationPublisher } from "./outbound/notification.publisher.port.js";
import { EVENT_RECORDED } from "../public/events/event.recorded.js";
import type { EventRecordedPayload } from "../public/events/event.recorded.js";
import type { TimelineEventSnapshot } from "../public/dto/timeline.event.dto.js";
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

function toEventSnapshot(e: TimelineEvent): TimelineEventSnapshot {
    return {
        id: e.id,
        taskId: e.taskId,
        ...(e.sessionId ? { sessionId: e.sessionId } : {}),
        kind: e.kind,
        lane: e.lane,
        title: e.title,
        ...(e.body ? { body: e.body } : {}),
        metadata: e.metadata,
        classification: e.classification,
        createdAt: e.createdAt,
    };
}

type EventRecordingInput = Parameters<typeof createEventRecordDraft>[0];

@Injectable()
export class LogEventUseCase {
    constructor(
        private readonly events: TimelineEventService,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: IEventNotificationPublisher,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
        private readonly dedupe: CrossCheckDedupeCache,
        private readonly eventBus: EventEmitter2,
    ) {}

    @Transactional()
    async execute(input: LogEventUseCaseIn): Promise<LogEventUseCaseOut> {
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

        const recorded = [primaryEvent, ...derivedEvents];
        const allEvents = recorded.map((e) => ({ id: e.id, kind: e.kind }));
        const sessionId = input.sessionId;

        if (marker) {
            this.dedupe.remember(input.kind, sessionId, marker.dedupeKey, primaryEvent.id);
        }

        // Emit the recorded fact; `work` applies the task-status effect and
        // `rules` runs verification. emitAsync runs subscribers inside this
        // transaction (suppressErrors:false), so a subscriber throw rolls the
        // event insert back — preserving the previous atomic semantics while
        // keeping timeline a leaf that commands no one.
        const payload: EventRecordedPayload = {
            events: recorded.map(toEventSnapshot),
            taskId: input.taskId,
            ...(sessionId ? { sessionId } : {}),
            ...(input.taskEffects?.taskStatus !== undefined
                ? { taskEffects: { taskStatus: input.taskEffects.taskStatus } }
                : {}),
        };
        await this.eventBus.emitAsync(EVENT_RECORDED, payload);

        return { ...(sessionId ? { sessionId } : {}), events: allEvents };
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
        return event;
    }
}
