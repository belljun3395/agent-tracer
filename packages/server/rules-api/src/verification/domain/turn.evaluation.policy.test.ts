import { describe, expect, it } from "vitest";
import type { Rule } from "@monitor/rules-api/rule/public/types/rule.types.js";
import { evaluateTurn } from "./turn.evaluation.policy.js";
import type { EvaluateTurnInput, EvaluateTurnToolCall } from "./turn.evaluation.policy.js";

const NOW = "2026-04-29T10:00:00.000Z";

function rule(overrides: Partial<Rule> & Pick<Rule, "expect">): Rule {
    return {
        id: "rule-1",
        name: "테스트 룰",
        scope: "global",
        source: "human",
        severity: "warn",
        createdAt: NOW,
        ...overrides,
    };
}

function evaluateOne(r: Rule, partial: Partial<EvaluateTurnInput>): ReturnType<typeof evaluateTurn>["verdicts"][number] | undefined {
    let counter = 0;
    const input: EvaluateTurnInput = {
        turnId: "turn-1",
        assistantText: "",
        toolCalls: [],
        rules: [r],
        now: NOW,
        newVerdictId: () => `v-${++counter}`,
        ...partial,
    };
    return evaluateTurn(input).verdicts[0];
}

function bash(command: string): EvaluateTurnToolCall {
    return { tool: "Bash", command };
}

describe("evaluateTurn — 턴 단위 룰 평가", () => {
    it("트리거 문구가 텍스트에 없으면 판정을 만들지 않는다", () => {
        const r = rule({ trigger: { phrases: ["테스트 실행"] }, expect: { action: "command" } });
        const verdict = evaluateOne(r, { assistantText: "그냥 설명만 했다" });
        expect(verdict).toBeUndefined();
    });

    it("트리거 문구 앞에 부정어가 있으면 트리거로 보지 않는다", () => {
        const r = rule({ trigger: { phrases: ["ran tests"] }, expect: { action: "command" } });
        const verdict = evaluateOne(r, { assistantText: "I did not run tests this time" });
        expect(verdict).toBeUndefined();
    });

    it("commandMatches에 부합하는 명령이 실행됐으면 verified", () => {
        const r = rule({ expect: { action: "command", commandMatches: ["npm test"] } });
        const verdict = evaluateOne(r, { toolCalls: [bash("npm test -- --run")] });
        expect(verdict?.status).toBe("verified");
        expect(verdict?.detail.matchedToolCalls).toEqual(["npm test -- --run"]);
    });

    it("commandMatches는 정규식이 아니라 리터럴 부분 문자열로 판정한다", () => {
        const r = rule({ expect: { action: "command", commandMatches: ["test("] } });
        const verdict = evaluateOne(r, { toolCalls: [bash("npm run test(unit)")] });
        expect(verdict?.status).toBe("verified");
    });

    it("기대한 명령이 실행되지 않았으면 contradicted", () => {
        const r = rule({ expect: { action: "command", commandMatches: ["npm test"] } });
        const verdict = evaluateOne(r, { toolCalls: [bash("ls -la")] });
        expect(verdict?.status).toBe("contradicted");
    });

    it("command 액션인데 도구 호출이 전혀 없으면 contradicted", () => {
        const r = rule({ expect: { action: "command", commandMatches: ["npm test"] } });
        const verdict = evaluateOne(r, { toolCalls: [] });
        expect(verdict?.status).toBe("contradicted");
    });

    it("정규식 메타문자가 있는 commandMatches도 리터럴 문자열로 매칭한다", () => {
        const r = rule({ expect: { action: "command", commandMatches: ["("] } });
        const verdict = evaluateOne(r, { toolCalls: [bash("npm run test(unit)")] });
        expect(verdict?.status).toBe("verified");
    });

    it("pattern이 파일 경로에 매칭되면 verified", () => {
        const r = rule({ expect: { action: "file-write", pattern: "\\.test\\.ts$" } });
        const verdict = evaluateOne(r, {
            toolCalls: [{ tool: "Edit", filePath: "src/foo.test.ts" }],
        });
        expect(verdict?.status).toBe("verified");
    });

    it("action만 지정되면 해당 액션 도구 호출 존재 여부로 판정한다", () => {
        const r = rule({ expect: { action: "file-read" } });
        expect(evaluateOne(r, { toolCalls: [{ tool: "Read", filePath: "a.ts" }] })?.status).toBe("verified");
        expect(evaluateOne(r, { toolCalls: [bash("ls")] })?.status).toBe("contradicted");
    });

    it("트리거가 없는 룰은 항상 평가된다", () => {
        const r = rule({ expect: { action: "command", commandMatches: ["npm test"] } });
        const verdict = evaluateOne(r, { assistantText: "", toolCalls: [bash("npm test")] });
        expect(verdict?.status).toBe("verified");
    });

    it("triggerOn='user'면 사용자 메시지에서 트리거를 찾는다", () => {
        const r = rule({
            triggerOn: "user",
            trigger: { phrases: ["배포해줘"] },
            expect: { action: "command", commandMatches: ["deploy"] },
        });
        const verdict = evaluateOne(r, {
            userMessageText: "이제 배포해줘",
            assistantText: "네",
            toolCalls: [bash("deploy prod")],
        });
        expect(verdict?.status).toBe("verified");
    });
});
