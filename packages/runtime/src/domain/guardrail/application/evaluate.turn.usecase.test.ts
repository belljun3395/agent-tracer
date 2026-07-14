import {KIND, RULE_EXPECTATION_KIND, RULE_REVIEW_STATE, RULE_SEVERITY} from "@monitor/kernel";
import {AGENT_TRACER_ATTR, SEMCONV_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import {describe, expect, it} from "vitest";
import {EvaluateTurnUsecase} from "~runtime/domain/guardrail/application/evaluate.turn.usecase.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";

const ANCHOR = "anchor-1";

function event(
    id: string,
    kind: string,
    body?: string,
    metadata: Record<string, unknown> = {},
): RecentEvent {
    return {
        id,
        kind,
        occurredAt: "2026-07-14T00:00:00.000Z",
        metadata,
        ...(body !== undefined ? {body} : {}),
    };
}

function anchorEvent(): RecentEvent {
    return event(ANCHOR, KIND.userMessage, "lint 돌리고 끝내");
}

function lintCall(id: string): RecentEvent {
    return event(id, KIND.executeTool, undefined, {
        [SEMCONV_ATTR.toolName]: "Bash",
        [AGENT_TRACER_ATTR.command]: "npm run lint",
    });
}

function rule(overrides: Partial<GuardrailRule> = {}): GuardrailRule {
    return {
        name: "수정 후 검증",
        severity: RULE_SEVERITY.block,
        taskId: "task-1",
        reviewState: RULE_REVIEW_STATE.active,
        anchorEventId: ANCHOR,
        expectation: {kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"]},
        ...overrides,
    };
}

const usecase = new EvaluateTurnUsecase();

describe("EvaluateTurnUsecase", () => {
    it("근거 입력 이후 기대 명령이 실행되면 이행으로 본다", () => {
        const result = usecase.execute([
            anchorEvent(),
            lintCall("e1"),
            event("e2", KIND.assistantResponse, "통과"),
        ], [rule()], "task-1");

        expect(result.verdicts[0]?.status).toBe("verified");
        expect(result.blocking).toHaveLength(0);
    });

    it("기대 명령이 없으면 턴을 붙잡는다", () => {
        const result = usecase.execute([
            anchorEvent(),
            event("e1", KIND.assistantResponse, "안 돌렸습니다"),
        ], [rule()], "task-1");

        expect(result.verdicts[0]?.status).toBe("contradicted");
        expect(result.blocking.map((verdict) => verdict.ruleName)).toEqual(["수정 후 검증"]);
    });

    it("승인 대기 규칙은 판정에서 제외한다", () => {
        const pending = rule({reviewState: RULE_REVIEW_STATE.pendingReview});

        expect(usecase.execute([anchorEvent()], [pending], "task-1").verdicts).toEqual([]);
    });

    it("다른 태스크의 규칙은 판정에서 제외한다", () => {
        const other = rule({taskId: "task-2"});

        expect(usecase.execute([anchorEvent()], [other], "task-1").verdicts).toEqual([]);
    });

    it("근거 입력이 최근 이벤트 버퍼 밖이면 판정하지 않는다", () => {
        const events = [event("later", KIND.userMessage, "다른 얘기"), lintCall("e1")];

        expect(usecase.execute(events, [rule()], "task-1").verdicts).toEqual([]);
    });

    it("근거 입력 이전의 도구 호출은 이행 증거가 아니다", () => {
        const result = usecase.execute([
            lintCall("before"),
            anchorEvent(),
            event("e1", KIND.assistantResponse, "끝"),
        ], [rule()], "task-1");

        expect(result.verdicts[0]?.status).toBe("contradicted");
    });
});
