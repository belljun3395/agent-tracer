import BetterSqlite3 from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createSchema } from "../schema/sqlite.schema.js";
import { SqliteTurnPartitionRepository } from "./sqlite.turn.partition.repository.js";
import type { TurnPartition } from "~domain/workflow/turn.partition.js";

const TASK_ID = "task-1";

function seedTask(db: BetterSqlite3.Database): void {
    db.prepare(`
        insert into tasks_current (
            id, title, slug, workspace_path, status, task_kind, parent_task_id,
            parent_session_id, background_task_id, created_at, updated_at, last_session_started_at, cli_source
        ) values (
            @id, @title, @slug, null, 'running', 'primary', null, null, null, @ts, @ts, null, null
        )
    `).run({ id: TASK_ID, title: "Demo", slug: TASK_ID, ts: "2026-04-22T10:00:00.000Z" });
}

function samplePartition(version = 1): TurnPartition {
    return {
        taskId: TASK_ID,
        groups: [
            { id: "g1", from: 1, to: 2, label: "Setup", visible: true },
            { id: "g2", from: 3, to: 3, label: null, visible: false },
        ],
        version,
        updatedAt: "2026-04-22T10:01:00.000Z",
    };
}

describe("SqliteTurnPartitionRepository", () => {
    it("upserts a partition and round-trips it", async () => {
        const db = new BetterSqlite3(":memory:");
        try {
            createSchema(db);
            seedTask(db);
            const repo = new SqliteTurnPartitionRepository(db);
            const partition = samplePartition();
            await repo.upsert(partition);
            const loaded = await repo.get(TASK_ID);
            expect(loaded).toEqual(partition);
        } finally {
            db.close();
        }
    });

    it("appends a turn.partition_updated curation event on upsert", async () => {
        const db = new BetterSqlite3(":memory:");
        try {
            createSchema(db);
            seedTask(db);
            const repo = new SqliteTurnPartitionRepository(db);
            await repo.upsert(samplePartition());
            const rows = db.prepare("select event_type from events where aggregate_id = ?").all(TASK_ID) as Array<{ event_type: string }>;
            expect(rows.some((r) => r.event_type === "turn.partition_updated")).toBe(true);
        } finally {
            db.close();
        }
    });

    it("delete removes the row and emits turn.partition_reset", async () => {
        const db = new BetterSqlite3(":memory:");
        try {
            createSchema(db);
            seedTask(db);
            const repo = new SqliteTurnPartitionRepository(db);
            await repo.upsert(samplePartition());
            await repo.delete(TASK_ID);
            const loaded = await repo.get(TASK_ID);
            expect(loaded).toBeNull();
            const rows = db.prepare("select event_type from events where aggregate_id = ?").all(TASK_ID) as Array<{ event_type: string }>;
            expect(rows.some((r) => r.event_type === "turn.partition_reset")).toBe(true);
        } finally {
            db.close();
        }
    });

    it("returns null when no partition stored", async () => {
        const db = new BetterSqlite3(":memory:");
        try {
            createSchema(db);
            seedTask(db);
            const repo = new SqliteTurnPartitionRepository(db);
            const loaded = await repo.get(TASK_ID);
            expect(loaded).toBeNull();
        } finally {
            db.close();
        }
    });

    it("upsert overwrites existing row", async () => {
        const db = new BetterSqlite3(":memory:");
        try {
            createSchema(db);
            seedTask(db);
            const repo = new SqliteTurnPartitionRepository(db);
            await repo.upsert(samplePartition(1));
            await repo.upsert(samplePartition(2));
            const loaded = await repo.get(TASK_ID);
            expect(loaded?.version).toBe(2);
        } finally {
            db.close();
        }
    });
});
