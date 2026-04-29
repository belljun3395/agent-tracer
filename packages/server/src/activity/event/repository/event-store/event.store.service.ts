import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AnyDomainEventDraft, DomainEvent } from "~activity/event/domain/event-store/model/domain.events.model.js";
import type { EventId, TimeRange } from "~activity/event/domain/event-store/model/event.model.js";
import { validateDomainEventDraft } from "~activity/event/domain/event-store/domain.events.js";
import { ContentBlobEntity } from "~activity/event/domain/event-store/content.blob.entity.js";
import { EventLogEntity } from "~activity/event/domain/event-store/event.log.entity.js";
import { CLOCK_PORT, ID_GENERATOR_PORT } from "~activity/event/application/outbound/tokens.js";
import type { IClock } from "~activity/event/application/outbound/clock.port.js";
import type { IIdGenerator } from "~activity/event/application/outbound/id.generator.port.js";
import { projectDomainEvent } from "./read.model.projector.js";
import type {
    ContentBlobRecord,
    ContentBlobWriteInput,
    IEventStore,
} from "./event.store.contract.js";

/**
 * TypeORM-backed event store. Driver-portable (better-sqlite3, pg, etc).
 * Read model projection still uses the underlying connection via projector
 * helpers — those will move to entity-based projections in a follow-up.
 */
@Injectable()
export class EventStoreService implements IEventStore {
    constructor(
        @InjectRepository(EventLogEntity)
        private readonly events: Repository<EventLogEntity>,
        @InjectRepository(ContentBlobEntity)
        private readonly blobs: Repository<ContentBlobEntity>,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
    ) {}

    async append(draft: AnyDomainEventDraft): Promise<DomainEvent> {
        validateDomainEventDraft(draft);

        const eventId = draft.eventId ?? this.idGen.newUlid(draft.eventTime);
        const recordedAt = draft.recordedAt ?? this.clock.nowMs();

        await this.events.insert({
            eventId,
            eventTime: draft.eventTime,
            eventType: draft.eventType,
            schemaVer: draft.schemaVer,
            aggregateId: draft.aggregateId,
            sessionId: draft.sessionId ?? null,
            actor: draft.actor,
            correlationId: draft.correlationId ?? null,
            causationId: draft.causationId ?? null,
            payloadJson: JSON.stringify(draft.payload),
            recordedAt,
        });

        const event: DomainEvent = {
            ...draft,
            eventId,
            recordedAt,
        };
        await projectDomainEvent(this.events.manager, event);
        return event;
    }

    async *readAggregate(aggregateId: string, from?: EventId): AsyncIterable<DomainEvent> {
        const qb = this.events.createQueryBuilder("e")
            .where("e.aggregate_id = :aggregateId", { aggregateId });
        if (from) {
            qb.andWhere("e.event_id > :from", { from });
        }
        qb.orderBy("e.event_time", "ASC").addOrderBy("e.event_id", "ASC");
        const rows = await qb.getMany();
        for (const row of rows) {
            yield mapEventRow(row);
        }
    }

    async *readByType(type: DomainEvent["eventType"], range: TimeRange = {}): AsyncIterable<DomainEvent> {
        const qb = this.events.createQueryBuilder("e")
            .where("e.event_type = :type", { type });
        if (range.from !== undefined) {
            qb.andWhere("e.event_time >= :fromTime", { fromTime: range.from });
        }
        if (range.to !== undefined) {
            qb.andWhere("e.event_time <= :toTime", { toTime: range.to });
        }
        qb.orderBy("e.event_time", "ASC").addOrderBy("e.event_id", "ASC");
        const rows = await qb.getMany();
        for (const row of rows) {
            yield mapEventRow(row);
        }
    }

    async putContentBlob(input: ContentBlobWriteInput): Promise<ContentBlobRecord> {
        const sha256 = createHash("sha256").update(input.body).digest("hex");
        const createdAt = input.createdAt ?? this.clock.nowMs();

        await this.blobs
            .createQueryBuilder()
            .insert()
            .values({
                sha256,
                byteSize: input.body.byteLength,
                mime: input.mime ?? null,
                createdAt,
                body: input.body,
            })
            .orIgnore()
            .execute();

        const row = await this.blobs.findOneBy({ sha256 });
        if (!row) {
            throw new Error(`Content blob ${sha256} could not be retrieved after insert`);
        }
        return mapBlobRow(row);
    }

    async getContentBlob(sha256: string): Promise<ContentBlobRecord | null> {
        const row = await this.blobs.findOneBy({ sha256 });
        return row ? mapBlobRow(row) : null;
    }
}

function mapEventRow(row: EventLogEntity): DomainEvent {
    return {
        eventId: row.eventId,
        eventTime: row.eventTime,
        eventType: row.eventType as DomainEvent["eventType"],
        schemaVer: row.schemaVer,
        aggregateId: row.aggregateId,
        ...(row.sessionId ? { sessionId: row.sessionId } : {}),
        actor: row.actor as DomainEvent["actor"],
        ...(row.correlationId ? { correlationId: row.correlationId } : {}),
        ...(row.causationId ? { causationId: row.causationId } : {}),
        payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
        recordedAt: row.recordedAt,
    };
}

function mapBlobRow(row: ContentBlobEntity): ContentBlobRecord {
    return {
        sha256: row.sha256,
        byteSize: row.byteSize,
        ...(row.mime ? { mime: row.mime } : {}),
        createdAt: row.createdAt,
        body: row.body,
    };
}
