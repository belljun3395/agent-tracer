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
});
