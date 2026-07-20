import { describe, expect, it } from "vitest";
import { RECIPE_SCAN_ANCHOR_FILTER } from "./task.const.js";
import { TaskEntity } from "./task.entity.js";
import { TaskUserStateEntity } from "./user-state/task.user.state.entity.js";
import { TaskView } from "./task.view.domain.js";

function makeTask(): TaskEntity {
    const task = new TaskEntity();
    task.id = "t1";
    task.userId = "u1";
    task.title = "원본 제목";
    task.slug = "t1-slug";
    task.workspacePath = null;
    task.status = "running";
    task.taskKind = "primary";
    task.origin = "user";
    task.parentTaskId = null;
    task.createdAt = new Date("2026-01-01T00:00:00.000Z");
    task.updatedAt = new Date("2026-01-01T00:00:00.000Z");
    task.lastEventAt = null;
    return task;
}

// 앵커 조건을 모두 만족하는 작업이며 각 테스트가 한 조건씩 무너뜨린다.
function makeAnchorTask(): TaskEntity {
    const task = makeTask();
    task.status = "completed";
    return task;
}

describe("TaskView", () => {
    describe("visibleTitle", () => {
        it("task의 title을 그대로 쓴다", () => {
            const view = new TaskView(makeTask(), null);
            expect(view.visibleTitle()).toBe("원본 제목");
        });

        it("state가 있어도 title은 task 쪽 값을 쓴다", () => {
            const state = TaskUserStateEntity.init("t1", "u1", new Date());
            const view = new TaskView(makeTask(), state);
            expect(view.visibleTitle()).toBe("원본 제목");
        });
    });

    describe("isArchived", () => {
        it("state가 보관 상태면 true를 반환한다", () => {
            const state = TaskUserStateEntity.init("t1", "u1", new Date());
            state.archive(new Date());
            const view = new TaskView(makeTask(), state);
            expect(view.isArchived()).toBe(true);
        });

        it("state가 없으면 false를 반환한다", () => {
            const view = new TaskView(makeTask(), null);
            expect(view.isArchived()).toBe(false);
        });
    });

    describe("isVisible", () => {
        it("state가 숨김 상태면 false를 반환한다", () => {
            const state = TaskUserStateEntity.init("t1", "u1", new Date());
            state.hide(new Date());
            const view = new TaskView(makeTask(), state);
            expect(view.isVisible()).toBe(false);
        });

        it("state가 없으면 true를 반환한다", () => {
            const view = new TaskView(makeTask(), null);
            expect(view.isVisible()).toBe(true);
        });
    });

    describe("isRecipeScanEligible", () => {
        it("완료된 사용자 루트 작업이면 true를 반환한다", () => {
            const view = new TaskView(makeAnchorTask(), null);
            expect(view.isRecipeScanEligible()).toBe(true);
        });

        it("보관된 작업도 앵커가 될 수 있다", () => {
            const state = TaskUserStateEntity.init("t1", "u1", new Date());
            state.archive(new Date());
            const view = new TaskView(makeAnchorTask(), state);
            expect(view.isRecipeScanEligible()).toBe(true);
        });

        it("숨긴 작업은 false를 반환한다", () => {
            const state = TaskUserStateEntity.init("t1", "u1", new Date());
            state.hide(new Date());
            const view = new TaskView(makeAnchorTask(), state);
            expect(view.isRecipeScanEligible()).toBe(false);
        });

        it("아직 완료되지 않은 작업은 false를 반환한다", () => {
            const task = makeAnchorTask();
            task.status = "running";
            expect(new TaskView(task, null).isRecipeScanEligible()).toBe(false);
        });

        it("에이전트가 실행한 server-sdk 작업은 false를 반환한다", () => {
            const task = makeAnchorTask();
            task.origin = "server-sdk";
            expect(new TaskView(task, null).isRecipeScanEligible()).toBe(false);
        });

        it("부모가 있는 서브에이전트 작업은 false를 반환한다", () => {
            const task = makeAnchorTask();
            task.parentTaskId = "parent";
            expect(new TaskView(task, null).isRecipeScanEligible()).toBe(false);
        });

        it("RECIPE_SCAN_ANCHOR_FILTER가 술어와 같은 조건을 표현한다", () => {
            const task = makeAnchorTask();
            expect(task.origin).toBe(RECIPE_SCAN_ANCHOR_FILTER.origin);
            expect(task.status).toBe(RECIPE_SCAN_ANCHOR_FILTER.status);
            expect(RECIPE_SCAN_ANCHOR_FILTER.rootOnly).toBe(true);
            expect(task.parentTaskId).toBeNull();
        });
    });

    describe("isSessionRecipeScanEligible", () => {
        it("아직 진행 중인 사용자 루트 작업도 앵커로 받는다", () => {
            const task = makeTask();
            expect(task.status).toBe("running");
            expect(new TaskView(task, null).isSessionRecipeScanEligible()).toBe(true);
        });

        it("완료된 사용자 루트 작업이면 true를 반환한다", () => {
            const view = new TaskView(makeAnchorTask(), null);
            expect(view.isSessionRecipeScanEligible()).toBe(true);
        });

        it("숨긴 작업은 진행 중이어도 false를 반환한다", () => {
            const state = TaskUserStateEntity.init("t1", "u1", new Date());
            state.hide(new Date());
            expect(new TaskView(makeTask(), state).isSessionRecipeScanEligible()).toBe(false);
        });

        it("에이전트가 실행한 server-sdk 작업은 false를 반환한다", () => {
            const task = makeTask();
            task.origin = "server-sdk";
            expect(new TaskView(task, null).isSessionRecipeScanEligible()).toBe(false);
        });

        it("부모가 있는 서브에이전트 작업은 false를 반환한다", () => {
            const task = makeTask();
            task.parentTaskId = "parent";
            expect(new TaskView(task, null).isSessionRecipeScanEligible()).toBe(false);
        });
    });

    describe("toListItem", () => {
        it("workspacePath가 null이면 필드를 아예 생략한다", () => {
            const view = new TaskView(makeTask(), null);
            expect(view.toListItem()).not.toHaveProperty("workspacePath");
        });

        it("workspacePath가 있으면 필드에 포함한다", () => {
            const task = makeTask();
            task.workspacePath = "/repo";
            const view = new TaskView(task, null);
            expect(view.toListItem().workspacePath).toBe("/repo");
        });

        it("archived 필드는 isArchived() 결과를 반영한다", () => {
            const state = TaskUserStateEntity.init("t1", "u1", new Date());
            state.archive(new Date());
            const view = new TaskView(makeTask(), state);
            expect(view.toListItem().archived).toBe(true);
        });
    });
});
