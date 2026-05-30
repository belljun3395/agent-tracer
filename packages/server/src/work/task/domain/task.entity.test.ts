import { describe, expect, it } from "vitest";
import { TaskEntity } from "./task.entity.js";

/**
 * TaskEntity 비즈니스 로직 테스트.
 *
 * 메서드 이름은 영어(isArchived / archive / unarchive)지만, 테스트 표시명은
 * 한글로 작성해 보관(archive) 상태머신 규칙을 콘솔에서 그대로 읽을 수 있게 한다.
 * (전체 표시명은 `npx vitest run --reporter=verbose` 로 확인)
 */
function makeTask(overrides: Partial<TaskEntity> = {}): TaskEntity {
    return Object.assign(new TaskEntity(), {
        id: "t1",
        title: "제목",
        slug: "jemok",
        workspacePath: null,
        status: "running" as const,
        taskKind: "primary" as const,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastSessionStartedAt: null,
        cliSource: null,
        archivedAt: null,
        origin: "user" as const,
    }, overrides);
}

const NOW = "2026-02-01T00:00:00.000Z";

describe("TaskEntity.isArchived — 보관 여부", () => {
    it("archived_at이 없으면 보관되지 않은 상태다", () => {
        expect(makeTask({ archivedAt: null }).isArchived()).toBe(false);
    });

    it("archived_at이 있으면 보관된 상태다", () => {
        expect(makeTask({ archivedAt: NOW }).isArchived()).toBe(true);
    });
});

describe("TaskEntity.archive — 보관 상태머신", () => {
    it("보관하면 archivedAt과 updatedAt이 해당 시각으로 설정된다", () => {
        const task = makeTask({ status: "completed" });
        task.archive(NOW);
        expect(task.archivedAt).toBe(NOW);
        expect(task.updatedAt).toBe(NOW);
    });

    it("running 상태를 보관하면 completed로 전환된다", () => {
        const task = makeTask({ status: "running" });
        task.archive(NOW);
        expect(task.status).toBe("completed");
    });

    it("waiting 상태를 보관하면 completed로 전환된다", () => {
        const task = makeTask({ status: "waiting" });
        task.archive(NOW);
        expect(task.status).toBe("completed");
    });

    it("errored 상태를 보관해도 상태는 errored로 유지된다", () => {
        const task = makeTask({ status: "errored" });
        task.archive(NOW);
        expect(task.status).toBe("errored");
    });
});

describe("TaskEntity.unarchive — 보관 해제", () => {
    it("보관 해제하면 archivedAt이 null이 되고 updatedAt만 갱신되며 상태는 유지된다", () => {
        const task = makeTask({ status: "completed", archivedAt: "2026-01-15T00:00:00.000Z" });
        task.unarchive(NOW);
        expect(task.archivedAt).toBeNull();
        expect(task.updatedAt).toBe(NOW);
        expect(task.status).toBe("completed");
    });
});
