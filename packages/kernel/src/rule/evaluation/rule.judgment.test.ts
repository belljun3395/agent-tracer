import { describe, expect, it } from "vitest";
import { judge, type JudgmentWindow } from "./rule.judgment.js";
import type { Observation } from "./rule.observation.js";
import { VERDICT_STATUS } from "./rule.verdict.js";
import { RULE_EXPECTATION_KIND, type RuleExpectation } from "../definition/rule.vocabulary.js";

const RUN_TESTS: RuleExpectation = {
    kind: RULE_EXPECTATION_KIND.command,
    commandMatches: ["npm test"],
};

function call(command: string): Observation {
    return { kind: "call", call: { tool: "Bash", command } };
}

function opaque(eventId: string): Observation {
    return { kind: "opaque", eventId };
}

function window(observations: readonly Observation[], covered = true): JudgmentWindow {
    return { observations, covered };
}

describe("judge", () => {
    it("이행 증거를 찾으면 satisfied로 종결한다", () => {
        const judgment = judge(RUN_TESTS, window([call("npm test")]));

        expect(judgment.status).toBe(VERDICT_STATUS.satisfied);
        expect(judgment.matchedToolCalls).toEqual(["npm test"]);
    });

    it("창을 빠짐없이 봤는데 증거가 없으면 아직 살아 있는 open이다", () => {
        const judgment = judge(RUN_TESTS, window([call("npm run build")]));

        expect(judgment.status).toBe(VERDICT_STATUS.open);
    });

    it("분류하지 못한 도구 호출이 있으면 미이행이라 단언하지 않는다", () => {
        const judgment = judge(RUN_TESTS, window([call("npm run build"), opaque("e9")]));

        expect(judgment.status).toBe(VERDICT_STATUS.unknown);
        expect(judgment.unclassifiedEventIds).toEqual(["e9"]);
    });

    it("창을 못 덮었으면 미이행이라 단언하지 않는다", () => {
        const judgment = judge(RUN_TESTS, window([call("npm run build")], false));

        expect(judgment.status).toBe(VERDICT_STATUS.unknown);
    });

    it("못 본 구간이 있어도 증거를 찾았으면 이행은 확실하다", () => {
        const judgment = judge(RUN_TESTS, window([call("npm test"), opaque("e9")], false));

        expect(judgment.status).toBe(VERDICT_STATUS.satisfied);
    });

    it("컴파일할 수 없는 패턴은 물을 수조차 없으므로 unknown이다", () => {
        const judgment = judge({ kind: RULE_EXPECTATION_KIND.pattern, pattern: "(" }, window([]));

        expect(judgment.status).toBe(VERDICT_STATUS.unknown);
    });
});
