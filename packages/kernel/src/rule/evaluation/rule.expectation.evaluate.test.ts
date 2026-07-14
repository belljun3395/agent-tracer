import { describe, expect, it } from "vitest";
import { evaluateExpectation } from "./rule.expectation.evaluate.js";
import { RULE_EXPECTATION_KIND, type ToolCall } from "../definition/rule.vocabulary.js";

const lint: ToolCall = { tool: "Bash", command: "npm run lint" };
const build: ToolCall = { tool: "Bash", command: "npm run build" };

describe("evaluateExpectation", () => {
    it("기대한 명령을 부른 호출이 있으면 verified다", () => {
        const outcome = evaluateExpectation(
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"] },
            [build, lint],
        );
        expect(outcome.status).toBe("verified");
        expect(outcome.expectedPattern).toBe("npm run lint");
        expect(outcome.matchedToolCalls).toEqual([lint.command]);
    });

    it("기대한 명령을 부르지 않았으면 contradicted다", () => {
        const outcome = evaluateExpectation(
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"] },
            [build],
        );
        expect(outcome.status).toBe("contradicted");
        expect(outcome.matchedToolCalls).toEqual([]);
    });

    it("도구 호출이 하나도 없으면 이행을 확인할 수 없어 contradicted다", () => {
        const outcome = evaluateExpectation(
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"] },
            [],
        );
        expect(outcome.status).toBe("contradicted");
    });
});
