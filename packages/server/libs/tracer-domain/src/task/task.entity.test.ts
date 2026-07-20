import { describe, expect, it } from "vitest";
import { TaskEntity } from "./task.entity.js";

function makeTask(updatedAt: Date, lastAppliedSeq: string | null = null): TaskEntity {
    const task = new TaskEntity();
    task.status = "running";
    task.updatedAt = updatedAt;
    task.lastEventAt = null;
    task.lastSessionStartedAt = null;
    task.lastAppliedSeq = lastAppliedSeq;
    return task;
}

describe("TaskEntity", () => {
    describe("applyLedgerStatusEffect", () => {
        it("아직 반영한 시퀀스가 없으면 상태를 반영하고 시퀀스를 기록한다", () => {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"));

            const changed = task.applyLedgerStatusEffect("completed", new Date("2026-01-01T00:01:00.000Z"), "10");

            expect(changed).toBe(true);
            expect(task.status).toBe("completed");
            expect(task.lastAppliedSeq).toBe("10");
        });

        it("이미 반영한 시퀀스보다 뒤진 전달은 무시한다", () => {
            const task = makeTask(new Date("2026-01-01T00:01:00.000Z"), "10");

            const changed = task.applyLedgerStatusEffect("errored", new Date("2026-01-01T00:02:00.000Z"), "9");

            expect(changed).toBe(false);
            expect(task.status).toBe("running");
            expect(task.lastAppliedSeq).toBe("10");
        });

        it("클라이언트 시계가 미래로 어긋나도 나중 시퀀스의 전이가 이긴다", () => {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"));

            task.applyLedgerStatusEffect("running", new Date("2030-01-01T00:00:00.000Z"), "5");
            const changed = task.applyLedgerStatusEffect("completed", new Date("2026-01-01T00:01:00.000Z"), "6");

            expect(changed).toBe(true);
            expect(task.status).toBe("completed");
        });

        it("자릿수가 갈리는 큰 시퀀스도 수치로 비교한다", () => {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"), "9");

            const changed = task.applyLedgerStatusEffect("completed", new Date("2026-01-01T00:01:00.000Z"), "10");

            expect(changed).toBe(true);
            expect(task.lastAppliedSeq).toBe("10");
        });

        it("같은 상태를 나중 시퀀스로 재적용하면 false를 반환한다", () => {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"), "1");

            const changed = task.applyLedgerStatusEffect("running", new Date("2026-01-01T00:01:00.000Z"), "2");

            expect(changed).toBe(false);
            expect(task.status).toBe("running");
        });
    });

    describe("forceStatus", () => {
        it("원장 밖 상태 변경은 시퀀스를 점유하지 않는다", () => {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"), "5");

            const changed = task.forceStatus("completed", new Date("2026-01-01T00:01:00.000Z"));

            expect(changed).toBe(true);
            expect(task.status).toBe("completed");
            expect(task.lastAppliedSeq).toBe("5");
        });

        it("회수 뒤 도착한 원장 이벤트가 여전히 반영된다", () => {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"), "5");
            task.forceStatus("completed", new Date("2026-01-01T00:01:00.000Z"));

            const changed = task.applyLedgerStatusEffect("errored", new Date("2026-01-01T00:02:00.000Z"), "6");

            expect(changed).toBe(true);
            expect(task.status).toBe("errored");
        });
    });

    describe("applyRankedTitle", () => {
        function makeTitledTask(title: string, titleRank: TaskEntity["titleRank"]): TaskEntity {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"));
            task.title = title;
            task.slug = "slug";
            task.titleRank = titleRank;
            return task;
        }

        it("저장된 순위보다 높은 순위가 오면 제목과 순위를 바꾼다", () => {
            const task = makeTitledTask("자동 제목", "auto");

            const changed = task.applyRankedTitle("사용자 제목", "user", new Date("2026-01-01T00:01:00.000Z"));

            expect(changed).toBe(true);
            expect(task.title).toBe("사용자 제목");
            expect(task.titleRank).toBe("user");
            expect(task.updatedAt).toEqual(new Date("2026-01-01T00:01:00.000Z"));
        });

        it("저장된 순위보다 낮은 순위가 오면 제목을 그대로 둔다", () => {
            const task = makeTitledTask("사용자 제목", "user");

            const changed = task.applyRankedTitle("자동 제목", "auto", new Date("2026-01-01T00:01:00.000Z"));

            expect(changed).toBe(false);
            expect(task.title).toBe("사용자 제목");
            expect(task.titleRank).toBe("user");
        });

        it("같은 순위는 나중 값이 이긴다", () => {
            const task = makeTitledTask("이전 제목", "auto");

            const changed = task.applyRankedTitle("나중 제목", "auto", new Date("2026-01-01T00:01:00.000Z"));

            expect(changed).toBe(true);
            expect(task.title).toBe("나중 제목");
        });

        it("제목에서 파생한 슬러그도 함께 갱신한다", () => {
            const task = makeTitledTask("Old Title", "auto");

            task.applyRankedTitle("New Title", "auto", new Date("2026-01-01T00:01:00.000Z"));

            expect(task.slug).toBe("new-title");
        });
    });

    describe("recordEventArrival", () => {
        it("lastEventAt이 없으면 도착 시각으로 채운다", () => {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"));
            task.recordEventArrival(new Date("2026-01-01T00:05:00.000Z"));
            expect(task.lastEventAt).toEqual(new Date("2026-01-01T00:05:00.000Z"));
        });

        it("더 늦은 도착 시각만 반영하고 더 이른 도착은 무시한다", () => {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"));
            task.lastEventAt = new Date("2026-01-01T00:10:00.000Z");
            task.recordEventArrival(new Date("2026-01-01T00:05:00.000Z"));
            expect(task.lastEventAt).toEqual(new Date("2026-01-01T00:10:00.000Z"));
        });
    });

    describe("recordSessionStart", () => {
        it("lastSessionStartedAt이 없으면 시작 시각으로 채운다", () => {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"));
            task.recordSessionStart(new Date("2026-01-01T00:05:00.000Z"));
            expect(task.lastSessionStartedAt).toEqual(new Date("2026-01-01T00:05:00.000Z"));
        });

        it("더 이른 시작 시각은 무시한다", () => {
            const task = makeTask(new Date("2026-01-01T00:00:00.000Z"));
            task.lastSessionStartedAt = new Date("2026-01-01T00:10:00.000Z");
            task.recordSessionStart(new Date("2026-01-01T00:05:00.000Z"));
            expect(task.lastSessionStartedAt).toEqual(new Date("2026-01-01T00:10:00.000Z"));
        });
    });

    describe("isCompleted", () => {
        it("status가 completed이면 true를 반환한다", () => {
            const task = makeTask(new Date());
            task.status = "completed";
            expect(task.isCompleted()).toBe(true);
        });

        it("status가 completed가 아니면 false를 반환한다", () => {
            const task = makeTask(new Date());
            task.status = "running";
            expect(task.isCompleted()).toBe(false);
        });
    });

    describe("isSessionRecipeScanAnchor", () => {
        it("진행 중인 사용자 루트 작업을 세션 스캔 앵커로 본다", () => {
            const task = makeTask(new Date());
            task.origin = "user";
            task.parentTaskId = null;

            expect(task.isSessionRecipeScanAnchor()).toBe(true);
        });

        it("server-sdk 작업은 세션 스캔 앵커로 보지 않는다", () => {
            const task = makeTask(new Date());
            task.origin = "server-sdk";
            task.parentTaskId = null;

            expect(task.isSessionRecipeScanAnchor()).toBe(false);
        });

        it("부모가 있는 작업은 세션 스캔 앵커로 보지 않는다", () => {
            const task = makeTask(new Date());
            task.origin = "user";
            task.parentTaskId = "parent";

            expect(task.isSessionRecipeScanAnchor()).toBe(false);
        });
    });

    describe("isRecipeScanAnchor", () => {
        it("완료된 사용자 루트 작업을 레시피 스캔 앵커로 본다", () => {
            const task = makeTask(new Date());
            task.origin = "user";
            task.parentTaskId = null;
            task.status = "completed";

            expect(task.isRecipeScanAnchor()).toBe(true);
        });

        it("완료되지 않은 사용자 루트 작업은 레시피 스캔 앵커로 보지 않는다", () => {
            const task = makeTask(new Date());
            task.origin = "user";
            task.parentTaskId = null;
            task.status = "running";

            expect(task.isRecipeScanAnchor()).toBe(false);
        });
    });

    describe("hasActivitySince", () => {
        it("마지막 이벤트가 없으면 새 활동이 없다고 본다", () => {
            const task = makeTask(new Date());
            task.lastEventAt = null;

            expect(task.hasActivitySince(null)).toBe(false);
        });

        it("관찰 시각이 없고 마지막 이벤트가 있으면 새 활동으로 본다", () => {
            const task = makeTask(new Date());
            task.lastEventAt = new Date("2026-01-01T00:01:00.000Z");

            expect(task.hasActivitySince(null)).toBe(true);
        });

        it("관찰 시각 뒤에 도착한 이벤트를 새 활동으로 본다", () => {
            const task = makeTask(new Date());
            task.lastEventAt = new Date("2026-01-01T00:02:00.000Z");

            expect(task.hasActivitySince(new Date("2026-01-01T00:01:00.000Z"))).toBe(true);
        });

        it("관찰 시각과 같거나 이른 이벤트는 새 활동으로 보지 않는다", () => {
            const task = makeTask(new Date());
            const observedAt = new Date("2026-01-01T00:01:00.000Z");

            task.lastEventAt = new Date("2026-01-01T00:01:00.000Z");
            expect(task.hasActivitySince(observedAt)).toBe(false);

            task.lastEventAt = new Date("2026-01-01T00:00:00.000Z");
            expect(task.hasActivitySince(observedAt)).toBe(false);
        });
    });
});
