import type Database from "better-sqlite3";

export function createEventLogSchema(db: Database.Database): void {
    db.exec(`
      create table if not exists events (
        event_id text primary key,
        event_time integer not null,
        event_type text not null,
        schema_ver integer not null,
        aggregate_id text not null,
        session_id text,
        actor text not null,
        correlation_id text,
        causation_id text,
        payload_json text not null,
        recorded_at integer not null
      );

      create index if not exists idx_events_aggregate_time
        on events(aggregate_id, event_time);

      create index if not exists idx_events_type_time
        on events(event_type, event_time);

      create index if not exists idx_events_session_time
        on events(session_id, event_time);

      create index if not exists idx_events_correlation
        on events(correlation_id);

      create table if not exists content_blobs (
        sha256 text primary key,
        byte_size integer not null,
        mime text,
        created_at integer not null,
        body blob not null
      );
    `);
}
