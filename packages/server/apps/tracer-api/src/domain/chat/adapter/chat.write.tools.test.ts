import { describe, expect, it } from "vitest";
import { CHAT_MUTATION_TOOLS, CHAT_TOOL } from "@monitor/kernel";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import type { ChatConfirmRequest, ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import { buildChatWriteToolHandlers, buildDeferredChatWriteToolHandlers } from "./chat.write.tools.js";

const NOW = new Date("2026-02-02T00:00:00.000Z");

function collectingSink(): { sink: ChatTurnSink; confirms: ChatConfirmRequest[] } {
    const confirms: ChatConfirmRequest[] = [];
    return {
        confirms,
        sink: {
            onAssistantDelta: () => {},
            onToolCall: () => {},
            onToolResult: () => {},
            onConfirmRequest: (request) => {
                confirms.push(request);
            },
        },
    };
}

describe("buildChatWriteToolHandlers", () => {
    it("모든 mutation 도구에 핸들러를 만든다", () => {
        const pendingTools = new InMemoryChatPendingToolRepository();
        const { sink } = collectingSink();
        const handlers = buildChatWriteToolHandlers({ userId: "u1", threadId: "th1", sink }, { pendingTools, clock: new FixedClock(NOW) });
        expect(new Set(Object.keys(handlers))).toEqual(new Set(CHAT_MUTATION_TOOLS));
    });

    it("쓰기 도구는 실행 대신 대기 행을 세우고 승인 요청을 흘리며 확인 대기 결과를 낸다", async () => {
        const pendingTools = new InMemoryChatPendingToolRepository();
        const { sink, confirms } = collectingSink();
        const handlers = buildChatWriteToolHandlers({ userId: "u1", threadId: "th1", sink }, { pendingTools, clock: new FixedClock(NOW) });

        const raw = await handlers[CHAT_TOOL.archiveTask]!({ taskId: "t1" });
        const result = JSON.parse(raw) as { confirmationId: string; status: string; toolName: string };

        expect(result.status).toBe("pending");
        expect(result.toolName).toBe(CHAT_TOOL.archiveTask);
        // 승인 요청이 같은 확인 id로 흘러나가고, 대기 행이 그 id로 남는다.
        expect(confirms).toHaveLength(1);
        expect(confirms[0]?.id).toBe(result.confirmationId);
        expect(confirms[0]?.toolName).toBe(CHAT_TOOL.archiveTask);
        const stored = await pendingTools.findById(result.confirmationId);
        expect(stored?.toolName).toBe(CHAT_TOOL.archiveTask);
        expect(stored?.args).toEqual({ taskId: "t1" });
        expect(stored?.isPending()).toBe(true);
    });

    it("필수 인자가 빠지면 대기 행을 만들지 않고 거절한다", async () => {
        const pendingTools = new InMemoryChatPendingToolRepository();
        const { sink, confirms } = collectingSink();
        const handlers = buildChatWriteToolHandlers({ userId: "u1", threadId: "th1", sink }, { pendingTools, clock: new FixedClock(NOW) });

        await expect(handlers[CHAT_TOOL.updateMemo]!({ body: "x" })).rejects.toThrow();
        expect(confirms).toHaveLength(0);
    });

    it("지연 핸들러는 성공 커밋 전까지 mutation 제안을 적재하지 않는다", async () => {
        const pendingTools = new InMemoryChatPendingToolRepository();
        const { sink, confirms } = collectingSink();
        const writes = buildDeferredChatWriteToolHandlers(
            { userId: "u1", threadId: "th1", sink },
            { pendingTools, clock: new FixedClock(NOW) },
        );

        const raw = await writes.handlers[CHAT_TOOL.archiveTask]!({ taskId: "t1" });
        const result = JSON.parse(raw) as { confirmationId: string };
        expect(await pendingTools.findById(result.confirmationId)).toBeNull();
        expect(confirms).toHaveLength(0);

        await writes.commit();
        expect(await pendingTools.findById(result.confirmationId)).not.toBeNull();
        expect(confirms[0]?.id).toBe(result.confirmationId);
    });
});
