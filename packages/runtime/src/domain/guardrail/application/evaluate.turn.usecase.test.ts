import {KIND, RULE_EXPECTATION_KIND, RULE_REVIEW_STATE, RULE_SEVERITY} from "@monitor/kernel";
import {AGENT_TRACER_ATTR, SEMCONV_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import {describe, expect, it} from "vitest";
import {EvaluateTurnUsecase} from "~runtime/domain/guardrail/application/evaluate.turn.usecase.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";

function event(kind: string, body?: string, metadata: Record<string, unknown> = {}): RecentEvent {
    return {
        kind,
        occurredAt: "2026-07-14T00:00:00.000Z",
        metadata,
        ...(body !== undefined ? {body} : {}),
    };
}

function rule(overrides: Partial<GuardrailRule> = {}): GuardrailRule {
    return {
        name: "수정 후 검증",
        severity: RULE_SEVERITY.block,
        scope: "global",
        taskId: null,
        reviewState: RULE_REVIEW_STATE.active,
        anchorEventId: null,
        trigger: {phrases: ["lint"], on: "user"},
        expectation: {kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"]},
        ...overrides,
    };
}

const usecase = new EvaluateTurnUsecase();

describe("EvaluateTurnUsecase", () => {
    it("트리거가 발화된 턴에서 기대 명령이 실행되면 이행으로 본다", () => {
        const result = usecase.execute([
            event(KIND.userMessage, "lint 돌리고 끝내"),
            event(KIND.executeTool, undefined, {
                [SEMCONV_ATTR.toolName]: "Bash",
                [AGENT_TRACER_ATTR.command]: "npm run lint",
            }),
            event(KIND.assistantResponse, "통과"),
        ], [rule()], "task-1");

        expect(result.verdicts[0]?.status).toBe("verified");
        expect(result.blocking).toHaveLength(0);
    });

    it("기대 명령이 없으면 턴을 붙잡는다", () => {
        const result = usecase.execute([
            event(KIND.userMessage, "lint 돌리고 끝내"),
            event(KIND.assistantResponse, "안 돌렸습니다"),
        ], [rule()], "task-1");

        expect(result.verdicts[0]?.status).toBe("contradicted");
        expect(result.blocking.map((verdict) => verdict.ruleName)).toEqual(["수정 후 검증"]);
    });

    it("승인 대기 규칙은 판정에서 제외한다", () => {
        const pending = rule({reviewState: RULE_REVIEW_STATE.pendingReview});

        expect(usecase.execute([event(KIND.userMessage, "lint 돌려")], [pending], "task-1").verdicts).toEqual([]);
    });

    it("아직 원장에 없는 최종 응답을 후보로 받아 판정을 완성한다", () => {
        const assistantRule = rule({trigger: {phrases: ["배포"], on: "assistant"}});
        const events = [event(KIND.userMessage, "아무거나 해줘")];

        expect(usecase.execute(events, [assistantRule], "task-1").verdicts).toHaveLength(0);
        expect(usecase.execute(events, [assistantRule], "task-1", {
            candidateAssistantText: "배포를 완료했습니다",
        }).verdicts).toHaveLength(1);
    });
});
