import BetterSqlite3 from "better-sqlite3";
import { BookmarkId, EventId, RuntimeSessionId, RuntimeSource, SessionId, TaskId } from "@monitor/core";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteBookmarkRepository, SqliteRuntimeBindingRepository, SqliteSessionRepository, createSchema } from "../../src/infrastructure/sqlite";

describe("sqlite simple repositories", () => {
  let db: BetterSqlite3.Database | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it("persists and queries sessions", async () => {
    db = createInMemoryDb();
    seedTask(db, { id: "task-1", title: "Session test task" });

    const repository = new SqliteSessionRepository(db);
    const created = await repository.create({
      id: SessionId("session-1"),
      taskId: TaskId("task-1"),
      status: "running",
      summary: "initial run",
      startedAt: "2026-03-28T00:00:00.000Z"
    });

    expect(created.id).toBe("session-1");
    expect(created.taskId).toBe("task-1");
    expect(created.summary).toBe("initial run");
    expect(await repository.findById(SessionId("session-1"))).toEqual(created);
    expect(await repository.findByTaskId(TaskId("task-1"))).toHaveLength(1);
    expect((await repository.findActiveByTaskId(TaskId("task-1")))?.id).toBe("session-1");
    expect(await repository.countRunningByTaskId(TaskId("task-1"))).toBe(1);

    await repository.updateStatus(SessionId("session-1"), "completed", "2026-03-28T01:00:00.000Z", "wrapped up");
    const updated = await repository.findById(SessionId("session-1"));
    expect(updated?.status).toBe("completed");
    expect(updated?.endedAt).toBe("2026-03-28T01:00:00.000Z");
    expect(updated?.summary).toBe("wrapped up");
    expect(await repository.findActiveByTaskId(TaskId("task-1"))).toBeNull();
    expect(await repository.countRunningByTaskId(TaskId("task-1"))).toBe(0);
  });

  it("tracks runtime bindings with upsert, lookup, clear, and delete", async () => {
    db = createInMemoryDb();
    seedTask(db, { id: "task-1", title: "Runtime binding task" });

    const repository = new SqliteRuntimeBindingRepository(db);
    const saved = await repository.upsert({
      runtimeSource: RuntimeSource("claude-plugin"),
      runtimeSessionId: RuntimeSessionId("runtime-1"),
      taskId: TaskId("task-1"),
      monitorSessionId: SessionId("monitor-session-1")
    });

    expect(saved.runtimeSource).toBe("claude-plugin");
    expect(saved.runtimeSessionId).toBe("runtime-1");
    expect((await repository.find(RuntimeSource("claude-plugin"), RuntimeSessionId("runtime-1")) )?.taskId).toBe("task-1");
    expect(await repository.findTaskId(RuntimeSource("claude-plugin"), RuntimeSessionId("runtime-1"))).toBe("task-1");
    expect(await repository.findLatestByTaskId(TaskId("task-1"))).toEqual({
      runtimeSource: "claude-plugin",
      runtimeSessionId: "runtime-1"
    });

    await repository.clearSession(RuntimeSource("claude-plugin"), RuntimeSessionId("runtime-1"));
    expect(await repository.find(RuntimeSource("claude-plugin"), RuntimeSessionId("runtime-1"))).toBeNull();
    expect(await repository.findTaskId(RuntimeSource("claude-plugin"), RuntimeSessionId("runtime-1"))).toBe("task-1");

    await repository.delete(RuntimeSource("claude-plugin"), RuntimeSessionId("runtime-1"));
    expect(await repository.findTaskId(RuntimeSource("claude-plugin"), RuntimeSessionId("runtime-1"))).toBeNull();
    expect(await repository.findLatestByTaskId(TaskId("task-1"))).toBeNull();
  });

  it("saves bookmarks, hydrates task and event titles, and deletes cleanly", async () => {
    db = createInMemoryDb();
    seedTask(db, { id: "task-1", title: "Bookmark task" });
    seedEvent(db, {
      id: "event-1",
      taskId: "task-1",
      title: "Event title",
      body: "Event body"
    });

    const repository = new SqliteBookmarkRepository(db);
    const saved = await repository.save({
      id: BookmarkId("bookmark-1"),
      taskId: TaskId("task-1"),
      eventId: EventId("event-1"),
      kind: "event",
      title: "Bookmark title",
      note: "Bookmark note",
      metadata: { source: "manual" }
    });

    expect(saved.id).toBe("bookmark-1");
    expect(saved.taskTitle).toBe("Bookmark task");
    expect(saved.eventTitle).toBe("Event title");
    expect(await repository.findByTaskId(TaskId("task-1"))).toHaveLength(1);
    expect(await repository.findAll()).toHaveLength(1);

    await repository.delete(BookmarkId("bookmark-1"));
    expect(await repository.findByTaskId(TaskId("task-1"))).toHaveLength(0);
    expect(await repository.findAll()).toHaveLength(0);
  });
});

function createInMemoryDb(): BetterSqlite3.Database {
  const db = new BetterSqlite3(":memory:");
  createSchema(db);
  return db;
}

function seedTask(
  db: BetterSqlite3.Database,
  input: {
    id: string;
    title: string;
    slug?: string;
  }
): void {
  db.prepare(`
    insert into monitoring_tasks (
      id, title, slug, workspace_path, status, task_kind, parent_task_id, parent_session_id,
      background_task_id, created_at, updated_at, last_session_started_at, cli_source
    ) values (
      @id, @title, @slug, null, 'running', 'primary', null, null,
      null, '2026-03-28T00:00:00.000Z', '2026-03-28T00:00:00.000Z',
      '2026-03-28T00:00:00.000Z', 'claude-plugin'
    )
  `).run({
    id: input.id,
    title: input.title,
    slug: input.slug ?? input.id
  });
}

function seedEvent(
  db: BetterSqlite3.Database,
  input: {
    id: string;
    taskId: string;
    title: string;
    body: string;
  }
): void {
  db.prepare(`
    insert into timeline_events (
      id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at
    ) values (
      @id, @taskId, null, 'context.saved', 'planning', @title, @body,
      '{}', '{"lane":"planning","tags":[],"matches":[]}', '2026-03-28T00:00:01.000Z'
    )
  `).run(input);
}
