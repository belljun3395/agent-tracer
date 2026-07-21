import { describe, expect, it } from "vitest";
import { CHAT_PENDING_TOOL_STATUS } from "./chat.const.js";
import { ChatPendingToolEntity } from "./chat.pending.tool.entity.js";

const NOW = new Date("2026-07-21T00:00:00.000Z");

function makePendingTool(): ChatPendingToolEntity {
    return ChatPendingToolEntity.create({
        id: "pt1",
        threadId: "t1",
        messageId: "m1",
        toolName: "delete_task",
        args: { taskId: "task-1" },
        now: NOW,
    });
}

describe("ChatPendingToolEntity", () => {
    describe("create", () => {
        it("pending 상태로 시작하고 resolvedAt은 아직 없다", () => {
            const pending = makePendingTool();
            expect(pending.status).toBe(CHAT_PENDING_TOOL_STATUS.pending);
            expect(pending.resolvedAt).toBeNull();
            expect(pending.isPending()).toBe(true);
        });
    });

    describe("approve", () => {
        it("approved로 전이하고 resolvedAt을 세운다", () => {
            const pending = makePendingTool();
            const resolvedAt = new Date("2026-07-21T01:00:00.000Z");

            pending.approve(resolvedAt);

            expect(pending.status).toBe(CHAT_PENDING_TOOL_STATUS.approved);
            expect(pending.resolvedAt).toEqual(resolvedAt);
            expect(pending.isPending()).toBe(false);
        });

        it("이미 판정된 도구를 다시 판정하면 던진다", () => {
            const pending = makePendingTool();
            pending.approve(NOW);
            expect(() => pending.approve(NOW)).toThrow();
            expect(() => pending.reject(NOW)).toThrow();
        });
    });

    describe("reject", () => {
        it("rejected로 전이하고 resolvedAt을 세운다", () => {
            const pending = makePendingTool();
            const resolvedAt = new Date("2026-07-21T02:00:00.000Z");

            pending.reject(resolvedAt);

            expect(pending.status).toBe(CHAT_PENDING_TOOL_STATUS.rejected);
            expect(pending.resolvedAt).toEqual(resolvedAt);
        });
    });
});
