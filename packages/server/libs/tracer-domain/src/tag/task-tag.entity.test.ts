import { describe, expect, it } from "vitest";
import { TaskTagEntity } from "./task-tag.entity.js";

describe("TaskTagEntity", () => {
    describe("create", () => {
        it("사용자·태스크·태그를 그대로 세운다", () => {
            const taskTag = TaskTagEntity.create({
                id: "tt-1",
                userId: "u1",
                taskId: "t1",
                tagId: "tag-1",
                now: new Date("2026-07-16T00:00:00.000Z"),
            });

            expect(taskTag.userId).toBe("u1");
            expect(taskTag.taskId).toBe("t1");
            expect(taskTag.tagId).toBe("tag-1");
            expect(taskTag.createdAt).toEqual(new Date("2026-07-16T00:00:00.000Z"));
        });
    });
});
