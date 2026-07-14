import {describe, expect, it} from "vitest";
import {
    ASKED_TEXT_MAX_LEN,
    ASSISTANT_SUMMARY_MAX_LEN,
    EVENT_TITLE_MAX_LEN,
    TURN_DIGEST_MAX_TURNS,
    digestEvents,
    digestExistingRules,
    digestTurns,
} from "~runtime/domain/rulegen/model/evidence.model.js";

describe("digestTurns", () => {
    it("턴의 식별자와 유저 요구와 응답 요약을 보존한다", () => {
        expect(digestTurns([{id: "turn-1", turnIndex: 1, askedText: "테스트 돌려", assistantText: "돌렸습니다"}]))
            .toEqual([{turnId: "turn-1", turnIndex: 1, askedText: "테스트 돌려", assistantSummary: "돌렸습니다"}]);
    });

    it("유저 발화가 없는 턴은 제외한다", () => {
        const digests = digestTurns([
            {id: "turn-1", turnIndex: 1, askedText: null, assistantText: "혼자 말함"},
            {id: "turn-2", turnIndex: 2, askedText: "질문"},
        ]);

        expect(digests.map((digest) => digest.turnIndex)).toEqual([2]);
    });

    it("인용할 식별자가 없는 턴은 제외한다", () => {
        expect(digestTurns([{turnIndex: 1, askedText: "식별자 없음"}])).toEqual([]);
    });

    it("턴 개수가 상한을 넘으면 최근 턴만 남긴다", () => {
        const many = Array.from({length: TURN_DIGEST_MAX_TURNS + 5}, (_, index) => ({
            id: `turn-${index + 1}`,
            turnIndex: index + 1,
            askedText: `요구 ${index + 1}`,
        }));

        const digests = digestTurns(many);

        expect(digests).toHaveLength(TURN_DIGEST_MAX_TURNS);
        expect(digests[0]?.turnIndex).toBe(6);
    });

    it("유저 요구는 상한까지, 응답 요약은 더 짧게 자른다", () => {
        const digests = digestTurns([{
            id: "turn-1",
            turnIndex: 1,
            askedText: "가".repeat(ASKED_TEXT_MAX_LEN + 100),
            assistantText: "나".repeat(ASSISTANT_SUMMARY_MAX_LEN + 100),
        }]);

        expect(digests[0]?.askedText).toHaveLength(ASKED_TEXT_MAX_LEN);
        expect(digests[0]?.assistantSummary).toHaveLength(ASSISTANT_SUMMARY_MAX_LEN);
    });

    it("turnIndex가 없으면 수집 순서로 번호를 매긴다", () => {
        expect(
            digestTurns([{id: "turn-1", askedText: "첫째"}, {id: "turn-2", askedText: "둘째"}])
                .map((digest) => digest.turnIndex),
        ).toEqual([1, 2]);
    });
});

describe("digestEvents", () => {
    it("종류나 식별자가 없는 항목은 버리고 제목과 본문을 자른다", () => {
        const events = digestEvents([
            {id: "event-0", title: "종류 없음"},
            {kind: "execute_tool", title: "식별자 없음"},
            {id: "event-1", turnId: "turn-1", kind: "execute_tool", title: "b".repeat(EVENT_TITLE_MAX_LEN + 20), body: "본문"},
        ]);

        expect(events).toEqual([
            {
                eventId: "event-1",
                turnId: "turn-1",
                kind: "execute_tool",
                title: "b".repeat(EVENT_TITLE_MAX_LEN),
                body: "본문",
            },
        ]);
    });

    it("턴에 매이지 않은 이벤트는 턴 식별자 없이 남긴다", () => {
        expect(digestEvents([{id: "event-2", kind: "execute_tool"}])[0]).not.toHaveProperty("turnId");
    });
});

describe("digestExistingRules", () => {
    it("중복 판단에 필요한 기대 조건을 남긴다", () => {
        expect(digestExistingRules([{name: "기존", expectation: {kind: "action", tool: "command"}}])).toEqual([
            {name: "기존", expect: {kind: "action", tool: "command"}},
        ]);
    });
});
