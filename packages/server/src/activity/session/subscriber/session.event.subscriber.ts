import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
    DataSource,
    EventSubscriber,
    type EntitySubscriberInterface,
    type InsertEvent,
    type Repository,
    type UpdateEvent,
} from "typeorm";
import { EventLogEntity } from "../domain/event.log.entity.js";
import { RuntimeBindingEntity } from "../domain/runtime.binding.entity.js";
import { SessionEntity } from "../domain/session.entity.js";
import { CLOCK_PORT, ID_GENERATOR_PORT } from "../application/outbound/tokens.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { IIdGenerator } from "../application/outbound/id.generator.port.js";

interface DomainEventDraft {
    readonly eventType: string;
    readonly eventTime: number;
    readonly aggregateId: string;
    readonly sessionId: string | null;
    readonly payload: Record<string, unknown>;
}

abstract class SessionLogSubscriberBase {
    constructor(
        protected readonly clock: IClock,
        protected readonly idGen: IIdGenerator,
    ) {}

    protected eventTimeFromIso(value: string | undefined): number {
        if (!value) return this.clock.nowMs();
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : this.clock.nowMs();
    }

    protected async appendEvent(
        repo: Repository<EventLogEntity>,
        draft: DomainEventDraft,
    ): Promise<void> {
        await repo.insert({
            eventId: this.idGen.newUlid(draft.eventTime),
            eventTime: draft.eventTime,
            eventType: draft.eventType,
            schemaVer: 1,
            aggregateId: draft.aggregateId,
            sessionId: draft.sessionId,
            actor: "system",
            correlationId: null,
            causationId: null,
            payloadJson: JSON.stringify(draft.payload),
            recordedAt: this.clock.nowMs(),
        });
    }
}

/**
 * Subscribes to SessionEntity lifecycle and writes the corresponding domain
 * events (session.started / session.ended) into the events log table.
 */
@Injectable()
@EventSubscriber()
export class SessionEntitySubscriber extends SessionLogSubscriberBase implements EntitySubscriberInterface<SessionEntity> {
    constructor(
        @InjectDataSource() dataSource: DataSource,
        @Inject(CLOCK_PORT) clock: IClock,
        @Inject(ID_GENERATOR_PORT) idGen: IIdGenerator,
    ) {
        super(clock, idGen);
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return SessionEntity;
    }

    async afterInsert(event: InsertEvent<SessionEntity>): Promise<void> {
        const session = event.entity;
        await this.appendEvent(event.manager.getRepository(EventLogEntity), {
            eventType: "session.started",
            eventTime: this.eventTimeFromIso(session.startedAt),
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
        if (!before.endedAt && after.endedAt && after.status !== "running") {
            await this.appendEvent(event.manager.getRepository(EventLogEntity), {
                eventType: "session.ended",
                eventTime: this.eventTimeFromIso(after.endedAt),
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
export class RuntimeBindingEntitySubscriber extends SessionLogSubscriberBase implements EntitySubscriberInterface<RuntimeBindingEntity> {
    constructor(
        @InjectDataSource() dataSource: DataSource,
        @Inject(CLOCK_PORT) clock: IClock,
        @Inject(ID_GENERATOR_PORT) idGen: IIdGenerator,
    ) {
        super(clock, idGen);
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return RuntimeBindingEntity;
    }

    async afterInsert(event: InsertEvent<RuntimeBindingEntity>): Promise<void> {
        const entity = event.entity;
        if (!entity.monitorSessionId) return;
        await this.appendEvent(event.manager.getRepository(EventLogEntity), {
            eventType: "session.bound",
            eventTime: this.eventTimeFromIso(entity.updatedAt),
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
        if (before.monitorSessionId === after.monitorSessionId) return;
        await this.appendEvent(event.manager.getRepository(EventLogEntity), {
            eventType: "session.bound",
            eventTime: this.eventTimeFromIso(after.updatedAt),
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
