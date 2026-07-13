import { describe, expect, it } from "vitest";
import { evaluateExpectation } from "./rule.expectation.evaluate.js";
import { RULE_EXPECTATION_KIND, type ToolCall } from "../definition/rule.vocabulary.js";

const push: ToolCall = { tool: "Bash", command: "git push --force origin main" };
const lint: ToolCall = { tool: "Bash", command: "npm run lint" };

describe("evaluateExpectation", () => {
    it("금지 위반 호출이 있으면 contradicted이고 위반 호출을 증거로 남긴다", () => {
        const outcome = evaluateExpectation(
            { kind: RULE_EXPECTATION_KIND.forbidden, forbiddenMatches: ["--force"] },
            [lint, push],
        );
        expect(outcome.status).toBe("contradicted");
        expect(outcome.forbiddenPattern).toBe("--force");
        expect(outcome.matchedToolCalls).toEqual([push.command]);
    });

    it("금지 전용 규칙은 위반이 없으면 verified다", () => {
        const outcome = evaluateExpectation(
            { kind: RULE_EXPECTATION_KIND.forbidden, forbiddenMatches: ["--force"] },
            [lint],
        );
        expect(outcome.status).toBe("verified");
        expect(outcome.matchedToolCalls).toEqual([]);
    });

    it("의무 조항과 결합하면 금지 위반이 의무 이행보다 우선한다", () => {
        const outcome = evaluateExpectation(
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"], forbiddenMatches: ["--force"] },
            [lint, push],
        );
        expect(outcome.status).toBe("contradicted");
        expect(outcome.forbiddenPattern).toBe("--force");
    });

    it("금지 위반이 없으면 의무 조항 평가로 넘어간다", () => {
        const outcome = evaluateExpectation(
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"], forbiddenMatches: ["--force"] },
            [lint],
        );
        expect(outcome.status).toBe("verified");
        expect(outcome.expectedPattern).toBe("npm run lint");
    });
});
