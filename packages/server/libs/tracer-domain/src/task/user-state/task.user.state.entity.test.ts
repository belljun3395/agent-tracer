import { describe, expect, it } from "vitest";
import { TaskUserStateEntity } from "./task.user.state.entity.js";
import { InvariantViolationError } from "@monitor/tracer-domain/error/invariant.error.js";

describe("TaskUserStateEntity", () => {
    describe("init", () => {
        it("보관·숨김 없이 초기 상태를 생성한다", () => {
            const now = new Date("2026-01-01T00:00:00.000Z");
            const state = TaskUserStateEntity.init("task-1", "user-1", now);
            expect(state.taskId).toBe("task-1");
            expect(state.userId).toBe("user-1");
            expect(state.isArchived()).toBe(false);
            expect(state.isHidden()).toBe(false);
        });
    });

    describe("archive / unarchive", () => {
        it("보관하면 isArchived가 true가 된다", () => {
            const state = TaskUserStateEntity.init("t", "u", new Date());
            state.archive(new Date("2026-01-01T00:05:00.000Z"));
            expect(state.isArchived()).toBe(true);
        });

        it("이미 보관된 항목을 다시 보관하면 예외를 던진다", () => {
            const state = TaskUserStateEntity.init("t", "u", new Date());
            state.archive(new Date("2026-01-01T00:05:00.000Z"));
            expect(() => state.archive(new Date("2026-01-01T00:06:00.000Z"))).toThrow(InvariantViolationError);
        });

        it("보관 해제하면 isArchived가 다시 false가 된다", () => {
            const state = TaskUserStateEntity.init("t", "u", new Date());
            state.archive(new Date("2026-01-01T00:05:00.000Z"));
            state.unarchive(new Date("2026-01-01T00:06:00.000Z"));
            expect(state.isArchived()).toBe(false);
        });
    });

    describe("hide", () => {
        it("숨기면 isHidden이 true가 된다", () => {
            const state = TaskUserStateEntity.init("t", "u", new Date());
            state.hide(new Date("2026-01-01T00:05:00.000Z"));
            expect(state.isHidden()).toBe(true);
        });
    });

    describe("rename", () => {
        it("제목을 바꾸면 customTitle에 반영된다", () => {
            const state = TaskUserStateEntity.init("t", "u", new Date());
            state.rename("새 제목", new Date("2026-01-01T00:05:00.000Z"));
            expect(state.customTitle).toBe("새 제목");
        });

        it("빈 제목으로는 이름을 바꿀 수 없다", () => {
            const state = TaskUserStateEntity.init("t", "u", new Date());
            expect(() => state.rename("   ", new Date())).toThrow(InvariantViolationError);
        });
    });
});
