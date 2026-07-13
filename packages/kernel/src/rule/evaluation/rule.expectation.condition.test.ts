import { describe, expect, it } from "vitest";
import { KIND } from "~kernel/ingest/event.kind.const.js";
import { AGENT_TRACER_ATTR, SEMCONV_ATTR } from "~kernel/observability/semconv.const.js";
import { expectFulfilledBy, forbiddenNeedleHit } from "./rule.expectation.condition.js";
import { RULE_EXPECTATION_KIND, type ToolCall } from "../definition/rule.vocabulary.js";

const push: ToolCall = { tool: "Bash", command: "git push --force origin main" };
const lint: ToolCall = { tool: "Bash", command: "npm run lint" };

describe("forbiddenNeedleHit", () => {
    it("명령에 금지 부분문자열이 있으면 그 문자열을 반환한다", () => {
        expect(forbiddenNeedleHit(push, ["--force"])).toBe("--force");
    });

    it("경로에도 대소문자 무시로 매칭한다", () => {
        expect(forbiddenNeedleHit({ tool: "Edit", filePath: "/app/.ENV" }, [".env"])).toBe(".env");
    });

    it("금지 문자열이 없으면 null이다", () => {
        expect(forbiddenNeedleHit(lint, ["--force"])).toBeNull();
    });
});

describe("expectFulfilledBy", () => {
    it("명령 기대가 단일 이벤트의 명령 증거와 일치하면 이행으로 판정한다", () => {
        expect(expectFulfilledBy(
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"] },
            {
                kind: KIND.executeTool,
                metadata: {
                    [SEMCONV_ATTR.toolName]: "Bash",
                    [AGENT_TRACER_ATTR.command]: "npm run lint -- --fix",
                },
            },
        )).toBe(true);
    });

    it("금지 기대는 단일 이벤트 이행으로 기록하지 않는다", () => {
        expect(expectFulfilledBy(
            { kind: RULE_EXPECTATION_KIND.forbidden, forbiddenMatches: ["--force"] },
            {
                kind: KIND.executeTool,
                metadata: {
                    [SEMCONV_ATTR.toolName]: "Bash",
                    [AGENT_TRACER_ATTR.command]: "git push --force",
                },
            },
        )).toBe(false);
    });
});
