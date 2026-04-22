import type Database from "better-sqlite3";
import type { ITurnPartitionRepository } from "~application/ports/repository/turn.partition.repository.js";
import type { TurnGroup, TurnPartition } from "~domain/workflow/turn.partition.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { appendDomainEvent, eventTimeFromIso } from "../events/index.js";

interface TurnPartitionRow {
    readonly task_id: string;
    readonly groups_json: string;
    readonly version: number;
    readonly updated_at: string;
}

export class SqliteTurnPartitionRepository implements ITurnPartitionRepository {
    private readonly db: Database.Database;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db).client;
    }

    async get(taskId: string): Promise<TurnPartition | null> {
        const row = this.db
            .prepare<{ taskId: string }, TurnPartitionRow>(
                "select task_id, groups_json, version, updated_at from turn_partitions_current where task_id = @taskId",
            )
            .get({ taskId });
        if (!row) return null;
        return mapRow(row);
    }

    async upsert(partition: TurnPartition): Promise<void> {
        this.db.transaction(() => {
            this.db
                .prepare(`
                    insert into turn_partitions_current (task_id, groups_json, version, updated_at)
                    values (@taskId, @groupsJson, @version, @updatedAt)
                    on conflict(task_id) do update set
                      groups_json = excluded.groups_json,
                      version     = excluded.version,
                      updated_at  = excluded.updated_at
                `)
                .run({
                    taskId: partition.taskId,
                    groupsJson: JSON.stringify(partition.groups),
                    version: partition.version,
                    updatedAt: partition.updatedAt,
                });

            appendDomainEvent(this.db, {
                eventTime: eventTimeFromIso(partition.updatedAt),
                eventType: "turn.partition_updated",
                schemaVer: 1,
                aggregateId: partition.taskId,
                actor: "user",
                payload: {
                    task_id: partition.taskId,
                    version: partition.version,
                    groups: partition.groups.map((g) => ({ ...g })),
                },
            });
        })();
    }

    async delete(taskId: string): Promise<void> {
        this.db.transaction(() => {
            const result = this.db
                .prepare("delete from turn_partitions_current where task_id = @taskId")
                .run({ taskId });
            if (result.changes > 0) {
                appendDomainEvent(this.db, {
                    eventTime: eventTimeFromIso(new Date().toISOString()),
                    eventType: "turn.partition_reset",
                    schemaVer: 1,
                    aggregateId: taskId,
                    actor: "user",
                    payload: { task_id: taskId },
                });
            }
        })();
    }
}

function mapRow(row: TurnPartitionRow): TurnPartition {
    const groups = parseGroups(row.groups_json);
    return {
        taskId: row.task_id,
        groups,
        version: row.version,
        updatedAt: row.updated_at,
    };
}

function parseGroups(raw: string): readonly TurnGroup[] {
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isTurnGroup);
    } catch {
        return [];
    }
}

function isTurnGroup(value: unknown): value is TurnGroup {
    if (!value || typeof value !== "object") return false;
    const g = value as Record<string, unknown>;
    return (
        typeof g["id"] === "string" &&
        typeof g["from"] === "number" &&
        typeof g["to"] === "number" &&
        (g["label"] === null || typeof g["label"] === "string") &&
        typeof g["visible"] === "boolean"
    );
}
