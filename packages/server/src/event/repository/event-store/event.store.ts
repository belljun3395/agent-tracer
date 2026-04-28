import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type { ContentBlobRecord, ContentBlobWriteInput, IEventStore } from "./event.store.contract.js";
import type { AnyDomainEventDraft, DomainEvent } from "~event/domain/event-store/model/domain.events.model.js";
import type { EventId, TimeRange } from "~event/domain/event-store/model/event.model.js";
import { validateDomainEventDraft } from "~event/domain/event-store/domain.events.js";
import { generateUlid } from "./ulid.js";
import { projectDomainEvent } from "./read.model.projector.js";

interface EventRow {
    readonly event_id: string;
    readonly event_time: number;
    readonly event_type: DomainEvent["eventType"];
    readonly schema_ver: number;
    readonly aggregate_id: string;
    readonly session_id: string | null;
    readonly actor: DomainEvent["actor"];
    readonly correlation_id: string | null;
    readonly causation_id: string | null;
    readonly payload_json: string;
    readonly recorded_at: number;
}

interface ContentBlobRow {
    readonly sha256: string;
    readonly byte_size: number;
    readonly mime: string | null;
    readonly created_at: number;
    readonly body: Buffer;
}

export class SqliteEventStore implements IEventStore {
    constructor(private readonly db: Database.Database) {}

    append(event: AnyDomainEventDraft): Promise<DomainEvent> {
        return Promise.resolve(appendDomainEvent(this.db, event));
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async *readAggregate(aggregateId: string, from?: EventId): AsyncIterable<DomainEvent> {
        const rows = this.db.prepare<{ aggregateId: string; from: string | null }, EventRow>(`
          select *
          from events
          where aggregate_id = @aggregateId
            and (@from is null or event_id > @from)
          order by event_time asc, event_id asc
        `).all({ aggregateId, from: from ?? null });

        for (const row of rows) {
            yield mapEventRow(row);
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async *readByType(type: DomainEvent["eventType"], range: TimeRange = {}): AsyncIterable<DomainEvent> {
        const rows = this.db.prepare<{ type: string; from: number | null; to: number | null }, EventRow>(`
          select *
          from events
          where event_type = @type
            and (@from is null or event_time >= @from)
            and (@to is null or event_time <= @to)
          order by event_time asc, event_id asc
        `).all({ type, from: range.from ?? null, to: range.to ?? null });

        for (const row of rows) {
            yield mapEventRow(row);
        }
    }

    putContentBlob(input: ContentBlobWriteInput): Promise<ContentBlobRecord> {
        return Promise.resolve(putContentBlob(this.db, input));
    }

    getContentBlob(sha256: string): Promise<ContentBlobRecord | null> {
        const row = this.db.prepare<{ sha256: string }, ContentBlobRow>(
            "select * from content_blobs where sha256 = @sha256",
        ).get({ sha256 });
        return Promise.resolve(row ? mapContentBlobRow(row) : null);
    }
}

export function appendDomainEvent(db: Database.Database, draft: AnyDomainEventDraft): DomainEvent {
    validateDomainEventDraft(draft);

    const eventId = draft.eventId ?? generateUlid(draft.eventTime);
    const recordedAt = draft.recordedAt ?? Date.now();
    db.prepare(`
      insert into events (
        event_id, event_time, event_type, schema_ver, aggregate_id, session_id, actor,
        correlation_id, causation_id, payload_json, recorded_at
      ) values (
        @eventId, @eventTime, @eventType, @schemaVer, @aggregateId, @sessionId, @actor,
        @correlationId, @causationId, @payloadJson, @recordedAt
      )
    `).run({
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
    projectDomainEvent(db, event);
    return event;
}

export function putContentBlob(db: Database.Database, input: ContentBlobWriteInput): ContentBlobRecord {
    const sha256 = createHash("sha256").update(input.body).digest("hex");
    const createdAt = input.createdAt ?? Date.now();
    db.prepare(`
      insert into content_blobs (sha256, byte_size, mime, created_at, body)
      values (@sha256, @byteSize, @mime, @createdAt, @body)
      on conflict(sha256) do nothing
    `).run({
        sha256,
        byteSize: input.body.byteLength,
        mime: input.mime ?? null,
        createdAt,
        body: input.body,
    });

    const row = db.prepare<{ sha256: string }, ContentBlobRow>(
        "select * from content_blobs where sha256 = @sha256",
    ).get({ sha256 });
    return mapContentBlobRow(row!);
}

function mapEventRow(row: EventRow): DomainEvent {
    return {
        eventId: row.event_id,
        eventTime: row.event_time,
        eventType: row.event_type,
        schemaVer: row.schema_ver,
        aggregateId: row.aggregate_id,
        ...(row.session_id ? { sessionId: row.session_id } : {}),
        actor: row.actor,
        ...(row.correlation_id ? { correlationId: row.correlation_id } : {}),
        ...(row.causation_id ? { causationId: row.causation_id } : {}),
        payload: JSON.parse(row.payload_json) as Record<string, unknown>,
        recordedAt: row.recorded_at,
    };
}

function mapContentBlobRow(row: ContentBlobRow): ContentBlobRecord {
    return {
        sha256: row.sha256,
        byteSize: row.byte_size,
        ...(row.mime ? { mime: row.mime } : {}),
        createdAt: row.created_at,
        body: row.body,
    };
}
