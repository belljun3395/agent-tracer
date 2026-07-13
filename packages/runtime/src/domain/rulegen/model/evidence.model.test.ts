import {describe, expect, it} from "vitest";
import {
    ASKED_TEXT_MAX_LEN,
    ASSISTANT_SUMMARY_MAX_LEN,
    EVENT_TITLE_MAX_LEN,
    TURN_DIGEST_MAX_TURNS,
    digestEvents,
    digestExistingRules,
    digestTurns,
    selectEvidence,
} from "~runtime/domain/rulegen/model/evidence.model.js";
import {RULEGEN_MODE} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";

describe("digestTurns", () => {
    it("턴의 유저 요구와 응답 요약을 보존한다", () => {
        expect(digestTurns([{turnIndex: 1, askedText: "테스트 돌려", assistantText: "돌렸습니다"}])).toEqual([
            {turnIndex: 1, askedText: "테스트 돌려", assistantSummary: "돌렸습니다"},
        ]);
    });

    it("유저 발화가 없는 턴은 제외한다", () => {
        const digests = digestTurns([
            {turnIndex: 1, askedText: null, assistantText: "혼자 말함"},
            {turnIndex: 2, askedText: "질문"},
        ]);

        expect(digests.map((digest) => digest.turnIndex)).toEqual([2]);
    });

    it("턴 개수가 상한을 넘으면 최근 턴만 남긴다", () => {
        const many = Array.from({length: TURN_DIGEST_MAX_TURNS + 5}, (_, index) => ({
            turnIndex: index + 1,
            askedText: `요구 ${index + 1}`,
        }));

        const digests = digestTurns(many);

        expect(digests).toHaveLength(TURN_DIGEST_MAX_TURNS);
        expect(digests[0]?.turnIndex).toBe(6);
    });

    it("유저 요구는 상한까지, 응답 요약은 더 짧게 자른다", () => {
        const digests = digestTurns([{
            turnIndex: 1,
            askedText: "가".repeat(ASKED_TEXT_MAX_LEN + 100),
            assistantText: "나".repeat(ASSISTANT_SUMMARY_MAX_LEN + 100),
        }]);

        expect(digests[0]?.askedText).toHaveLength(ASKED_TEXT_MAX_LEN);
        expect(digests[0]?.assistantSummary).toHaveLength(ASSISTANT_SUMMARY_MAX_LEN);
    });

    it("turnIndex가 없으면 수집 순서로 번호를 매긴다", () => {
        expect(digestTurns([{askedText: "첫째"}, {askedText: "둘째"}]).map((digest) => digest.turnIndex))
            .toEqual([1, 2]);
    });
});

describe("digestEvents", () => {
    it("종류가 없는 항목은 버리고 제목과 본문을 자른다", () => {
        const events = digestEvents([
            {title: "종류 없음"},
            {kind: "execute_tool", title: "b".repeat(EVENT_TITLE_MAX_LEN + 20), body: "본문"},
        ]);

        expect(events).toEqual([
            {kind: "execute_tool", title: "b".repeat(EVENT_TITLE_MAX_LEN), body: "본문"},
        ]);
    });
});

describe("digestExistingRules", () => {
    it("중복 판단에 필요한 트리거와 기대 조건을 남긴다", () => {
        expect(digestExistingRules([{name: "기존", trigger: {phrases: ["test"]}}])).toEqual([
            {name: "기존", trigger: {phrases: ["test"]}, expect: null},
        ]);
    });
});

describe("selectEvidence", () => {
    const turns = Array.from({length: 3}, (_, index) => ({
        turnIndex: index + 1,
        askedText: `요구 ${index + 1}`,
        assistantSummary: "응답",
    }));
    const events = Array.from({length: 60}, (_, index) => ({
        kind: "execute_tool",
        title: `event ${index + 1}`,
        body: "",
    }));

    it("자동 트리거는 마지막 턴 하나와 이벤트 다섯 개만 남긴다", () => {
        const selected = selectEvidence(RULEGEN_MODE.recent, {turns, events, existingRules: []});

        expect(selected.turns.map((turn) => turn.turnIndex)).toEqual([3]);
        expect(selected.events).toHaveLength(5);
        expect(selected.events.at(-1)?.title).toBe("event 60");
    });

    it("수동 생성은 전체 턴과 최근 이벤트 오십 개를 남긴다", () => {
        const selected = selectEvidence(RULEGEN_MODE.manual, {turns, events, existingRules: []});

        expect(selected.turns).toHaveLength(3);
        expect(selected.events).toHaveLength(50);
        expect(selected.events[0]?.title).toBe("event 11");
    });
});
