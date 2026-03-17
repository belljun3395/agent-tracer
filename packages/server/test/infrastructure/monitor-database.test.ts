import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MonitorDatabase } from "../../src/infrastructure/monitor-database.js";

/** in-memory SQLite를 사용한 MonitorDatabase 단위 테스트 */
describe("MonitorDatabase", () => {
  let db: MonitorDatabase;

  beforeEach(() => {
    db = new MonitorDatabase({ filename: ":memory:" });
  });

  afterEach(() => {
    db.connection.close();
  });

  describe("upsertTask", () => {
    it("새 태스크를 생성한다", () => {
      const task = db.upsertTask({
        id: "task-1",
        title: "Test Task",
        slug: "test-task",
        status: "running",
        taskKind: "primary",
        createdAt: "2026-03-17T00:00:00.000Z",
        updatedAt: "2026-03-17T00:00:00.000Z"
      });
      expect(task.id).toBe("task-1");
      expect(task.title).toBe("Test Task");
      expect(task.status).toBe("running");
    });

    it("기존 태스크를 업데이트(upsert)한다", () => {
      const base = {
        id: "task-1", title: "Old", slug: "old", status: "running" as const,
        taskKind: "primary" as const,
        createdAt: "2026-03-17T00:00:00.000Z", updatedAt: "2026-03-17T00:00:00.000Z"
      };
      db.upsertTask(base);
      const updated = db.upsertTask({ ...base, title: "New", status: "completed" });
      expect(updated.title).toBe("New");
      expect(updated.status).toBe("completed");
    });
  });

  describe("deleteTask", () => {
    it("존재하지 않는 태스크 → not_found", () => {
      expect(db.deleteTask("no-such-id")).toBe("not_found");
    });

    it("실행 중인 태스크도 강제 삭제 가능 → deleted", () => {
      db.upsertTask({
        id: "t1", title: "T", slug: "t", status: "running",
        taskKind: "primary",
        createdAt: "2026-03-17T00:00:00.000Z", updatedAt: "2026-03-17T00:00:00.000Z"
      });
      expect(db.deleteTask("t1")).toBe("deleted");
    });

    it("완료된 태스크 삭제 성공 → deleted", () => {
      db.upsertTask({
        id: "t1", title: "T", slug: "t", status: "completed",
        taskKind: "primary",
        createdAt: "2026-03-17T00:00:00.000Z", updatedAt: "2026-03-17T00:00:00.000Z"
      });
      expect(db.deleteTask("t1")).toBe("deleted");
      expect(db.getTask("t1")).toBeUndefined();
    });

    it("부모 태스크 삭제 시 자식/손자 태스크도 함께 삭제한다", () => {
      const now = "2026-03-17T00:00:00.000Z";
      db.upsertTask({
        id: "parent", title: "Parent", slug: "parent", status: "running",
        taskKind: "primary",
        createdAt: now, updatedAt: now
      });
      db.upsertTask({
        id: "child", title: "Child", slug: "child", status: "running",
        taskKind: "background",
        parentTaskId: "parent",
        createdAt: now, updatedAt: now
      });
      db.upsertTask({
        id: "grandchild", title: "Grandchild", slug: "grandchild", status: "running",
        taskKind: "background",
        parentTaskId: "child",
        createdAt: now, updatedAt: now
      });

      expect(db.deleteTask("parent")).toBe("deleted");
      expect(db.getTask("parent")).toBeUndefined();
      expect(db.getTask("child")).toBeUndefined();
      expect(db.getTask("grandchild")).toBeUndefined();
    });
  });

  describe("getOverviewStats", () => {
    it("빈 DB의 통계는 모두 0이다", () => {
      const stats = db.getOverviewStats();
      expect(stats.totalTasks).toBe(0);
      expect(stats.runningTasks).toBe(0);
    });

    it("태스크 상태별 카운트가 정확하다", () => {
      for (const [id, status] of [["t1","running"],["t2","completed"],["t3","errored"]] as const) {
        db.upsertTask({
          id, title: id, slug: id, status,
          taskKind: "primary",
          createdAt: "2026-03-17T00:00:00.000Z", updatedAt: "2026-03-17T00:00:00.000Z"
        });
      }
      const stats = db.getOverviewStats();
      expect(stats.totalTasks).toBe(3);
      expect(stats.runningTasks).toBe(1);
      expect(stats.completedTasks).toBe(1);
      expect(stats.erroredTasks).toBe(1);
    });
  });

  describe("bookmarks and search", () => {
    it("북마크를 저장하고 다시 읽을 수 있다", () => {
      const now = "2026-03-17T00:00:00.000Z";
      db.upsertTask({
        id: "task-bookmark",
        title: "Bookmark Task",
        slug: "bookmark-task",
        status: "running",
        taskKind: "primary",
        createdAt: now,
        updatedAt: now
      });

      db.appendEvent({
        id: "event-bookmark",
        taskId: "task-bookmark",
        kind: "todo.logged",
        lane: "todos",
        title: "Bookmarkable todo",
        metadata: { todoId: "todo-1" },
        classification: { lane: "todos", tags: [], matches: [] },
        createdAt: now
      });

      db.upsertBookmark({
        id: "bookmark-1",
        taskId: "task-bookmark",
        eventId: "event-bookmark",
        kind: "event",
        title: "Saved todo",
        createdAt: now,
        updatedAt: now
      });

      const bookmarks = db.listBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]?.eventId).toBe("event-bookmark");
      expect(bookmarks[0]?.eventTitle).toBe("Bookmarkable todo");
    });

    it("태스크, 이벤트, 북마크를 함께 검색한다", () => {
      const now = "2026-03-17T00:00:00.000Z";
      db.upsertTask({
        id: "task-search",
        title: "Search Target Task",
        slug: "search-target-task",
        status: "running",
        taskKind: "primary",
        createdAt: now,
        updatedAt: now
      });

      db.appendEvent({
        id: "event-search",
        taskId: "task-search",
        kind: "agent.activity.logged",
        lane: "coordination",
        title: "Search MCP call",
        body: "monitor_agent_activity",
        metadata: { activityType: "mcp_call" },
        classification: { lane: "coordination", tags: [], matches: [] },
        createdAt: now
      });

      db.upsertBookmark({
        id: "bookmark-search",
        taskId: "task-search",
        kind: "task",
        title: "Search bookmark",
        createdAt: now,
        updatedAt: now
      });

      const results = db.search("search");
      expect(results.tasks.some((task) => task.taskId === "task-search")).toBe(true);
      expect(results.events.some((event) => event.eventId === "event-search")).toBe(true);
      expect(results.bookmarks.some((bookmark) => bookmark.bookmarkId === "bookmark-search")).toBe(true);
    });
  });
});
