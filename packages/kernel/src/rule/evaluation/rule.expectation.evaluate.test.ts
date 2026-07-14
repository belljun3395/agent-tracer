import { describe, expect, it } from "vitest";
import { evaluateExpectation } from "./rule.expectation.evaluate.js";
import { RULE_EXPECTATION_KIND, type ToolCall } from "../definition/rule.vocabulary.js";

const lint: ToolCall = { tool: "Bash", command: "npm run lint" };
const build: ToolCall = { tool: "Bash", command: "npm run build" };

describe("evaluateExpectation", () => {
    it("기대한 명령을 부른 호출이 있으면 이행이다", () => {
        const outcome = evaluateExpectation(
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"] },
            [build, lint],
        );
        expect(outcome.fulfilled).toBe(true);
        expect(outcome.expectedPattern).toBe("npm run lint");
        expect(outcome.matchedToolCalls).toEqual([lint.command]);
    });

    it("기대한 명령을 부르지 않았으면 이행이 아니다", () => {
        const outcome = evaluateExpectation(
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"] },
            [build],
        );
        expect(outcome.fulfilled).toBe(false);
        expect(outcome.matchedToolCalls).toEqual([]);
    });

    it("도구 호출이 하나도 없으면 이행이 아니되 판정 불가는 아니다", () => {
        const outcome = evaluateExpectation(
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"] },
            [],
        );
        expect(outcome.fulfilled).toBe(false);
        expect(outcome.unverifiable).toBe(false);
    });

    it("컴파일할 수 없는 패턴은 이행 여부를 물을 수 없다", () => {
        const outcome = evaluateExpectation({ kind: RULE_EXPECTATION_KIND.pattern, pattern: "(" }, [lint]);

        expect(outcome.unverifiable).toBe(true);
        expect(outcome.fulfilled).toBe(false);
    });
});
