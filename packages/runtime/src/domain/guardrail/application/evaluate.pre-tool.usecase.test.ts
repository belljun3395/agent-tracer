import {KIND, RULE_EXPECTATION_KIND, RULE_REVIEW_STATE, RULE_SEVERITY} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {EvaluatePreToolUsecase} from "~runtime/domain/guardrail/application/evaluate.pre-tool.usecase.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";

const TURN: RecentEvent[] = [{
    kind: KIND.userMessage,
    occurredAt: "2026-07-14T00:00:00.000Z",
    body: "푸시해줘",
    metadata: {},
}];

function rule(overrides: Partial<GuardrailRule> = {}): GuardrailRule {
    return {
        name: "강제 푸시 금지",
        severity: RULE_SEVERITY.block,
        scope: "global",
        taskId: null,
        reviewState: RULE_REVIEW_STATE.active,
        anchorEventId: null,
        trigger: {phrases: []},
        expectation: {kind: RULE_EXPECTATION_KIND.forbidden, forbiddenMatches: ["--force"]},
        ...overrides,
    };
}

const usecase = new EvaluatePreToolUsecase();
const FORCE_PUSH = {tool: "Bash", command: "git push --force"};

describe("EvaluatePreToolUsecase", () => {
    it("금지 패턴에 걸리는 호출을 규칙 이름과 패턴으로 거부한다", () => {
        expect(usecase.execute(TURN, [rule()], "task-1", FORCE_PUSH))
            .toEqual({ruleName: "강제 푸시 금지", needle: "--force"});
    });

    it("금지 패턴에 안 걸리면 거부하지 않는다", () => {
        expect(usecase.execute(TURN, [rule()], "task-1", {tool: "Bash", command: "git push"})).toBeNull();
    });

    it("severity가 block이 아니면 사전 거부하지 않는다", () => {
        expect(usecase.execute(TURN, [rule({severity: RULE_SEVERITY.warn})], "task-1", FORCE_PUSH)).toBeNull();
    });

    it("다른 태스크 스코프 규칙은 거부하지 않는다", () => {
        const scoped = rule({scope: "task", taskId: "other-task"});

        expect(usecase.execute(TURN, [scoped], "task-1", FORCE_PUSH)).toBeNull();
    });

    it("승인 대기 block 규칙은 사전 거부하지 않는다", () => {
        const pending = rule({reviewState: RULE_REVIEW_STATE.pendingReview});

        expect(usecase.execute(TURN, [pending], "task-1", FORCE_PUSH)).toBeNull();
    });
});
