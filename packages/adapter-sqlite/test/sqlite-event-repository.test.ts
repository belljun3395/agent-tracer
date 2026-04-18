import BetterSqlite3 from "better-sqlite3";
import { EventId, TaskId } from "@monitor/domain";
import { describe, expect, it } from "vitest";
import { SqliteEventRepository, backfillSearchDocuments, createSchema } from "@monitor/adapter-sqlite";
describe("sqlite event repository search", () => {
    it("returns semantic event hits even without lexical overlap", async () => {
        const db = new BetterSqlite3(":memory:");
        const taskId = TaskId("task-1");
        const eventId = EventId("event-1");
        createSchema(db);
        db.prepare(`
      insert into monitoring_tasks (
        id, title, slug, workspace_path, status, task_kind, parent_task_id, parent_session_id,
        background_task_id, created_at, updated_at, last_session_started_at, cli_source
      ) values (
        @taskId, 'Refactor branch logic', 'refactor-branch-logic', null, 'completed', 'primary',
        null, null, null, '2026-03-28T00:00:00.000Z', '2026-03-28T00:00:00.000Z',
        '2026-03-28T00:00:00.000Z', 'claude-plugin'
      )
    `).run({ taskId });
        db.prepare(`
      insert into timeline_events (
        id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at
      ) values (
        @eventId, @taskId, null, 'context.saved', 'implementation', 'Guard clause cleanup',
        'Flatten nested branch handling in shared logic.',
        '{}', '{"lane":"implementation","tags":[],"matches":[]}', '2026-03-28T00:00:10.000Z'
      )
    `).run({ eventId, taskId });
        backfillSearchDocuments(db);
        const repository = new SqliteEventRepository(db, {
            modelId: "test-model",
            embed: async (text: string) => text.includes("branch simplification")
                ? new Float32Array([1, 0, 0])
                : new Float32Array([1, 0, 0])
        });
        const results = await repository.search("branch simplification");
        expect(results.events).toHaveLength(1);
        expect(results.events[0]?.eventId).toBe(eventId);
        db.close();
    });
});
