import { describe, it, expect, beforeEach } from "vitest";
import { MonitorService } from "../../src/application/monitor-service.js";

/** MonitorService 통합 테스트 — 실제 in-memory SQLite 사용 */
describe("MonitorService", () => {
  let service: MonitorService;

  beforeEach(() => {
    service = new MonitorService({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
  });

  describe("startTask", () => {
    it("태스크 생성 후 envelope을 반환한다", () => {
      const result = service.startTask({ title: "Test Task" });
      expect(result.task.title).toBe("Test Task");
      expect(result.task.status).toBe("running");
      expect(result.sessionId).toBeDefined();
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.kind).toBe("task.start");
    });

    it("taskId 지정 시 해당 ID로 생성한다", () => {
      const result = service.startTask({ title: "T", taskId: "custom-id" });
      expect(result.task.id).toBe("custom-id");
    });
  });

  describe("completeTask", () => {
    it("태스크를 완료 처리한다", () => {
      const { task } = service.startTask({ title: "T" });
      const result = service.completeTask({ taskId: task.id });
      expect(result.task.status).toBe("completed");
    });

    it("존재하지 않는 태스크 완료 시 에러를 던진다", () => {
      expect(() => service.completeTask({ taskId: "no-such" })).toThrow();
    });
  });

  describe("renameTask", () => {
    it("태스크 이름을 변경한다", () => {
      const { task } = service.startTask({ title: "Old" });
      const renamed = service.renameTask({ taskId: task.id, title: "New" });
      expect(renamed?.title).toBe("New");
    });

    it("존재하지 않는 태스크 → undefined 반환", () => {
      expect(service.renameTask({ taskId: "no-such", title: "X" })).toBeUndefined();
    });

    it("같은 이름으로 변경 시 그대로 반환한다", () => {
      const { task } = service.startTask({ title: "Same" });
      const result = service.renameTask({ taskId: task.id, title: "Same" });
      expect(result?.title).toBe("Same");
    });
  });

  describe("deleteTask", () => {
    it("실행 중인 태스크는 삭제할 수 없다 → running", () => {
      const { task } = service.startTask({ title: "T" });
      expect(service.deleteTask(task.id)).toBe("running");
    });

    it("완료된 태스크를 삭제한다 → deleted", () => {
      const { task } = service.startTask({ title: "T" });
      service.completeTask({ taskId: task.id });
      expect(service.deleteTask(task.id)).toBe("deleted");
    });
  });
});
