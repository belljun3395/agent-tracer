import type Database from "better-sqlite3";

const TURN_PARTITION_DDL = `
  create table if not exists turn_partitions_current (
    task_id text primary key references tasks_current(id) on delete cascade,
    groups_json text not null,
    version integer not null default 1,
    updated_at text not null
  );
`;

export function createTurnPartitionSchema(db: Database.Database): void {
    db.exec(TURN_PARTITION_DDL);
}
