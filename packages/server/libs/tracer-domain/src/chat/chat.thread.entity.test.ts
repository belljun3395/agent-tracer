import { describe, expect, it } from "vitest";
import { CHAT_BACKEND } from "./chat.const.js";
import { ChatThreadEntity } from "./chat.thread.entity.js";

const NOW = new Date("2026-07-21T00:00:00.000Z");

function makeThread(): ChatThreadEntity {
    return ChatThreadEntity.create({ id: "thread-1", userId: "u1", title: "새 대화", now: NOW });
}

describe("ChatThreadEntity", () => {
    describe("create", () => {
        it("summary와 backend를 아직 없는 상태로 시작한다", () => {
            const thread = makeThread();
            expect(thread.summary).toBeNull();
            expect(thread.backend).toBeNull();
            expect(thread.createdAt).toEqual(NOW);
            expect(thread.updatedAt).toEqual(NOW);
        });
    });

    describe("rename", () => {
        it("제목을 바꾸고 updatedAt을 민다", () => {
            const thread = makeThread();
            const renamedAt = new Date("2026-07-21T01:00:00.000Z");

            thread.rename("이름 바꾼 대화", renamedAt);

            expect(thread.title).toBe("이름 바꾼 대화");
            expect(thread.updatedAt).toEqual(renamedAt);
        });
    });

    describe("updateSummary", () => {
        it("요약을 세우고 updatedAt을 민다", () => {
            const thread = makeThread();
            const summarizedAt = new Date("2026-07-21T02:00:00.000Z");

            thread.updateSummary("요약", summarizedAt);

            expect(thread.summary).toBe("요약");
            expect(thread.updatedAt).toEqual(summarizedAt);
        });
    });

    describe("recordTurn / ranOnClaudeSdk", () => {
        it("턴을 실행한 백엔드를 기록하고 판정 헬퍼가 그것을 반영한다", () => {
            const thread = makeThread();
            const ranAt = new Date("2026-07-21T03:00:00.000Z");

            thread.recordTurn(CHAT_BACKEND.claudeSdk, ranAt);

            expect(thread.backend).toBe(CHAT_BACKEND.claudeSdk);
            expect(thread.updatedAt).toEqual(ranAt);
            expect(thread.ranOnClaudeSdk()).toBe(true);
        });

        it("파이썬 백엔드로 기록되면 ranOnClaudeSdk는 false다", () => {
            const thread = makeThread();
            thread.recordTurn(CHAT_BACKEND.python, NOW);
            expect(thread.ranOnClaudeSdk()).toBe(false);
        });
    });
});
