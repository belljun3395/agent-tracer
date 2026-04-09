import BetterSqlite3 from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SqliteEventRepository } from "../../src/infrastructure/sqlite";
import { createSchema } from "../../src/infrastructure/sqlite/sqlite-schema.js";
import { backfillSearchDocuments } from "../../src/infrastructure/sqlite/sqlite-search-documents.js";
describe("sqlite event repository search", () => {
    it("returns semantic event hits even without lexical overlap", async () => {
        const db = new BetterSqlite3(":memory:");
        createSchema(db);
        db.prepare(`
      insert into monitoring_tasks (
        id, title, slug, workspace_path, status, task_kind, parent_task_id, parent_session_id,
        background_task_id, created_at, updated_at, last_session_started_at, cli_source
      ) values (
        'task-1', 'Refactor branch logic', 'refactor-branch-logic', null, 'completed', 'primary',
        null, null, null, '2026-03-28T00:00:00.000Z', '2026-03-28T00:00:00.000Z',
        '2026-03-28T00:00:00.000Z', 'claude-plugin'
      )
    `).run();
        db.prepare(`
      insert into timeline_events (
        id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at
      ) values (
        'event-1', 'task-1', null, 'context.saved', 'implementation', 'Guard clause cleanup',
        'Flatten nested branch handling in shared logic.',
        '{}', '{"lane":"implementation","tags":[],"matches":[]}', '2026-03-28T00:00:10.000Z'
      )
    `).run();
        backfillSearchDocuments(db);
        const repository = new SqliteEventRepository(db, {
            embed: async (text: string) => text.includes("branch simplification")
                ? new Float32Array([1, 0, 0])
                : new Float32Array([1, 0, 0])
        });
        const results = await repository.search("branch simplification");
        expect(results.events).toHaveLength(1);
        expect(results.events[0]?.eventId).toBe("event-1");
        db.close();
    });
});
