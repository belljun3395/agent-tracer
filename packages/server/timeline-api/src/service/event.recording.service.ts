import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional, runOnTransactionCommit } from "typeorm-transactional";
import { createEventRecordDraft, normalizeFilePaths, deriveFileChangeEventInputs } from "@monitor/timeline-api/domain/event.recording.policy.js";
import type { TimelineEvent } from "@monitor/timeline-api/domain/type/timeline.event.type.js";
import { projectTimelineEvent } from "../domain/timeline.event.projection.policy.js";
import { CrossCheckDedupeCache } from "../common/cross.check.dedupe.cache.js";
import { NOTIFICATION_PUBLISHER_PORT } from "../application/outbound/tokens.js";
import { TimelineEventStorageService } from "./timeline.event.storage.service.js";
import type { IEventNotificationPublisher } from "../application/outbound/notification.publisher.port.js";
import { EVENT_RECORDED } from "../public/events/event.recorded.js";
import type { EventRecordedPayload } from "../public/events/event.recorded.js";
import type { TimelineEventSnapshot } from "../public/dto/timeline.event.dto.js";
import type { EventRecordingIn, EventRecordingOut } from "../application/dto/event.recording.dto.js";

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

type EventRecordDraftInput = Parameters<typeof createEventRecordDraft>[0];

@Injectable()
export class EventRecordingService {
    constructor(
        private readonly events: TimelineEventStorageService,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: IEventNotificationPublisher,
        private readonly dedupe: CrossCheckDedupeCache,
        private readonly eventBus: EventEmitter2,
    ) {}

    @Transactional()
    async record(input: EventRecordingIn): Promise<EventRecordingOut> {
        // 멱등: 같은 id가 이미 기록됐으면 재파생·재발행 없이 그대로 반환(재시도·재전달).
        const existing = await this.events.findById(input.id);
        if (existing) {
            return {
                ...(input.sessionId ? { sessionId: input.sessionId } : {}),
                events: [{ id: existing.id, kind: existing.kind }],
            };
        }

        const marker = readCrossCheckMarker(input.metadata);
        if (marker) {
            const existingId = this.dedupe.lookup(input.kind, input.sessionId, marker.dedupeKey);
            if (existingId) {
                // 같은 세션의 cross-check 중복 이벤트는 새 행 대신 기존 이벤트 metadata에 병합한다.
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
        const primaryEvent = await this.insertEvent(input.id, {
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
        const derivedInputs = deriveFileChangeEventInputs({
            sourceEvent: primaryEvent,
            filePaths,
            ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        });
        // 파생 이벤트 id는 부모 id 기반으로 결정적 → 재처리해도 같은 id라 멱등.
        for (let i = 0; i < derivedInputs.length; i++) {
            derivedEvents.push(await this.insertEvent(`${primaryEvent.id}#file#${i}`, derivedInputs[i]!));
        }

        const recorded = [primaryEvent, ...derivedEvents];
        const allEvents = recorded.map((e) => ({ id: e.id, kind: e.kind }));
        const sessionId = input.sessionId;

        if (marker) {
            // 다음 cross-check 중복이 같은 이벤트를 재사용하도록 대표 이벤트를 기억한다.
            this.dedupe.remember(input.kind, sessionId, marker.dedupeKey, primaryEvent.id);
        }

        const payload: EventRecordedPayload = {
            events: recorded.map(toEventSnapshot),
            taskId: input.taskId,
            ...(sessionId ? { sessionId } : {}),
            ...(input.taskEffects?.taskStatus !== undefined
                ? { taskEffects: { taskStatus: input.taskEffects.taskStatus } }
                : {}),
        };
        // 구독자의 상태 변경이 실패하면 이벤트 저장도 같이 롤백되도록 같은 트랜잭션 안에서 실행한다.
        await this.eventBus.emitAsync(EVENT_RECORDED, payload);

        return { ...(sessionId ? { sessionId } : {}), events: allEvents };
    }

    private async insertEvent(id: string, input: EventRecordDraftInput): Promise<TimelineEvent> {
        const record = createEventRecordDraft(input);
        const event = await this.events.insert({
            id,
            ...record,
        });

        // 커밋된 이벤트만 대시보드로 보내 가짜 행을 만들지 않는다.
        runOnTransactionCommit(() => {
            this.notifier.publish({ type: NOTIFICATION_TYPE.eventLogged, payload: projectTimelineEvent(event) });
        });
        return event;
    }
}
