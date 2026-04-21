import BetterSqlite3 from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { DOMAIN_EVENT_DEFINITIONS } from "~domain/events/index.js";
import { SqliteRuleCommandRepository } from "../repositories/sqlite.rule-command.repository.js";
import { SqliteTaskRepository } from "../repositories/sqlite.task.repository.js";
import { createSqliteDatabase } from "../shared/drizzle.db.js";
import { createSchema } from "../schema/sqlite.schema.js";
import { appendDomainEvent, putContentBlob, SqliteEventStore } from "./sqlite.event-store.js";

describe("SQLite event log", () => {
    it("creates event log schema and reads aggregate events in event order", async () => {
        const db = new BetterSqlite3(":memory:");
        try {
            createSchema(db);
            appendDomainEvent(db, {
                eventTime: 1000,
                eventType: "task.created",
                schemaVer: 1,
                aggregateId: "task-1",
                actor: "user",
                payload: {
                    task_id: "task-1",
                    title: "Initial task",
                    slug: "initial-task",
                    kind: "primary",
                },
            });
            appendDomainEvent(db, {
                eventTime: 1001,
                eventType: "task.status_changed",
                schemaVer: 1,
                aggregateId: "task-1",
                actor: "system",
                payload: {
                    task_id: "task-1",
                    from: "running",
                    to: "completed",
                },
            });

            const store = new SqliteEventStore(db);
            const events = [];
            for await (const event of store.readAggregate("task-1")) {
                events.push(event);
            }

            expect(events.map((event) => event.eventType)).toEqual(["task.created", "task.status_changed"]);
        } finally {
            db.close();
        }
    });

    it("deduplicates content blobs by sha256", () => {
        const db = new BetterSqlite3(":memory:");
        try {
            createSchema(db);
            const first = putContentBlob(db, { body: Buffer.from("same body"), mime: "text/plain", createdAt: 1 });
            const second = putContentBlob(db, { body: Buffer.from("same body"), mime: "text/plain", createdAt: 2 });

            expect(second.sha256).toBe(first.sha256);
            expect(db.prepare("select count(*) as count from content_blobs").get()).toMatchObject({ count: 1 });
        } finally {
            db.close();
        }
    });

    it("keeps state write and event append in the same transaction", async () => {
        const db = new BetterSqlite3(":memory:");
        try {
            createSchema(db);
            const repo = new SqliteRuleCommandRepository(createSqliteDatabase(db));

            await expect(repo.create({
                id: "rule-1",
                pattern: "",
                label: "Invalid rule",
            })).rejects.toThrow(/pattern/);

            expect(db.prepare("select count(*) as count from rule_commands_current").get()).toMatchObject({ count: 0 });
            expect(db.prepare("select count(*) as count from events").get()).toMatchObject({ count: 0 });
        } finally {
            db.close();
        }
    });

    it("projects task current state from appended events", async () => {
        const db = new BetterSqlite3(":memory:");
        try {
            createSchema(db);
            const store = new SqliteEventStore(db);
            await store.append({
                eventTime: 1000,
                eventType: "task.created",
                schemaVer: 1,
                aggregateId: "task-1",
                actor: "user",
                payload: {
                    task_id: "task-1",
                    title: "Initial task",
                    slug: "initial-task",
                    kind: "primary",
                },
            });
            await store.append({
                eventTime: 2000,
                eventType: "task.status_changed",
                schemaVer: 1,
                aggregateId: "task-1",
                actor: "system",
                payload: {
                    task_id: "task-1",
                    from: "running",
                    to: "completed",
                },
            });

            const repo = new SqliteTaskRepository(createSqliteDatabase(db));
            const task = await repo.findById("task-1");

            expect(task).toMatchObject({
                id: "task-1",
                title: "Initial task",
                status: "completed",
            });
            expect(tableExists(db, "monitoring_tasks")).toBe(false);
        } finally {
            db.close();
        }
    });

    it("defines the Phase 0 event type catalog", () => {
        expect(DOMAIN_EVENT_DEFINITIONS).toHaveLength(22);
    });
});

function tableExists(db: BetterSqlite3.Database, tableName: string): boolean {
    const row = db.prepare<{ tableName: string }, { name: string }>(
        "select name from sqlite_master where type = 'table' and name = @tableName",
    ).get({ tableName });
    return Boolean(row);
}
