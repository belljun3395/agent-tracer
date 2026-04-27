import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
    DataSource,
    EventSubscriber,
    type EntitySubscriberInterface,
    type InsertEvent,
    type Repository,
    type UpdateEvent,
} from "typeorm";
import { generateUlid } from "~adapters/persistence/sqlite/events/ulid.js";
import { EventLogEntity } from "../domain/event.log.entity.js";
import { RuntimeBindingEntity } from "../domain/runtime.binding.entity.js";
import { SessionEntity } from "../domain/session.entity.js";

interface DomainEventDraft {
    readonly eventType: string;
    readonly eventTime: number;
    readonly aggregateId: string;
    readonly sessionId: string | null;
    readonly payload: Record<string, unknown>;
}

function eventTimeFromIso(value: string | undefined, fallback = Date.now()): number {
    if (!value) return fallback;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

async function appendEvent(
    repo: Repository<EventLogEntity>,
    draft: DomainEventDraft,
): Promise<void> {
    const eventId = generateUlid(draft.eventTime);
    const recordedAt = Date.now();
    await repo.insert({
        eventId,
        eventTime: draft.eventTime,
        eventType: draft.eventType,
        schemaVer: 1,
        aggregateId: draft.aggregateId,
        sessionId: draft.sessionId,
        actor: "system",
        correlationId: null,
        causationId: null,
        payloadJson: JSON.stringify(draft.payload),
        recordedAt,
    });
}

/**
 * Subscribes to SessionEntity lifecycle and writes the corresponding domain
 * events (session.started / session.ended) into the events log table.
 *
 * SessionEntity is the source of truth for sessions; the events log is the
 * append-only audit trail kept consistent by this subscriber.
 */
@Injectable()
@EventSubscriber()
export class SessionEntitySubscriber implements EntitySubscriberInterface<SessionEntity> {
    constructor(@InjectDataSource() dataSource: DataSource) {
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return SessionEntity;
    }

    async afterInsert(event: InsertEvent<SessionEntity>): Promise<void> {
        const session = event.entity;
        await appendEvent(event.manager.getRepository(EventLogEntity), {
            eventType: "session.started",
            eventTime: eventTimeFromIso(session.startedAt),
            aggregateId: session.taskId,
            sessionId: session.id,
            payload: {
                task_id: session.taskId,
                session_id: session.id,
            },
        });
    }

    async afterUpdate(event: UpdateEvent<SessionEntity>): Promise<void> {
        const before = event.databaseEntity;
        const after = event.entity as SessionEntity | undefined;
        if (!after) return;
        // Detect transition from running -> terminal (status changed and endedAt was just set).
        if (!before.endedAt && after.endedAt && after.status !== "running") {
            await appendEvent(event.manager.getRepository(EventLogEntity), {
                eventType: "session.ended",
                eventTime: eventTimeFromIso(after.endedAt),
                aggregateId: before.taskId,
                sessionId: before.id,
                payload: {
                    session_id: before.id,
                    outcome: after.status,
                    ...(after.summary ? { summary: after.summary } : {}),
                },
            });
        }
    }
}

/**
 * Subscribes to RuntimeBindingEntity lifecycle and emits session.bound events
 * whenever a binding is created or updated with a non-null monitor session id.
 */
@Injectable()
@EventSubscriber()
export class RuntimeBindingEntitySubscriber implements EntitySubscriberInterface<RuntimeBindingEntity> {
    constructor(@InjectDataSource() dataSource: DataSource) {
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return RuntimeBindingEntity;
    }

    async afterInsert(event: InsertEvent<RuntimeBindingEntity>): Promise<void> {
        const entity = event.entity;
        if (!entity.monitorSessionId) return;
        await appendEvent(event.manager.getRepository(EventLogEntity), {
            eventType: "session.bound",
            eventTime: eventTimeFromIso(entity.updatedAt),
            aggregateId: entity.taskId,
            sessionId: entity.monitorSessionId,
            payload: {
                session_id: entity.monitorSessionId,
                runtime_source: entity.runtimeSource,
                runtime_session_id: entity.runtimeSessionId,
            },
        });
    }

    async afterUpdate(event: UpdateEvent<RuntimeBindingEntity>): Promise<void> {
        const after = event.entity as RuntimeBindingEntity | undefined;
        if (!after?.monitorSessionId) return;
        const before = event.databaseEntity;
        // Only emit when the monitor session id was newly set or changed.
        if (before.monitorSessionId === after.monitorSessionId) return;
        await appendEvent(event.manager.getRepository(EventLogEntity), {
            eventType: "session.bound",
            eventTime: eventTimeFromIso(after.updatedAt),
            aggregateId: after.taskId,
            sessionId: after.monitorSessionId,
            payload: {
                session_id: after.monitorSessionId,
                runtime_source: after.runtimeSource,
                runtime_session_id: after.runtimeSessionId,
            },
        });
    }
}
