import { evaluateExpectation } from "./rule.expectation.evaluate.js";
import { observedCalls, unclassifiedEventIds, type Observation } from "./rule.observation.js";
import { VERDICT_STATUS, type VerdictStatus } from "./rule.verdict.js";
import type { RuleExpectation } from "../definition/rule.vocabulary.js";

/** 규칙을 낳은 사용자 입력부터 지금까지의 관측이다. */
export interface JudgmentWindow {
    readonly observations: readonly Observation[];
    /** 근거 입력부터 지금까지를 빠짐없이 손에 쥐었는지이며 로컬 버퍼는 창을 못 덮을 수 있다. */
    readonly covered: boolean;
}

export interface Judgment {
    readonly status: VerdictStatus;
    readonly expectedPattern?: string;
    readonly actualToolCalls: string[];
    readonly matchedToolCalls: string[];
    /** 도구 호출인데 분류하지 못한 이벤트이며 하나라도 있으면 이행 여부를 단언할 수 없다. */
    readonly unclassifiedEventIds: string[];
}

/** 이행 증거를 찾지 못한 것을 미이행이라 부를 자격은 창을 빠짐없이 관측했을 때만 생긴다. */
export function judge(expectation: RuleExpectation, window: JudgmentWindow): Judgment {
    const unclassified = unclassifiedEventIds(window.observations);
    const outcome = evaluateExpectation(expectation, observedCalls(window.observations));
    const evidence = {
        ...(outcome.expectedPattern !== undefined ? { expectedPattern: outcome.expectedPattern } : {}),
        actualToolCalls: outcome.actualToolCalls,
        matchedToolCalls: outcome.matchedToolCalls,
        unclassifiedEventIds: unclassified,
    };

    if (outcome.unverifiable) return { status: VERDICT_STATUS.unknown, ...evidence };
    // 증거를 찾았으면 못 본 구간이 있어도 이행은 확실하다.
    if (outcome.fulfilled) return { status: VERDICT_STATUS.satisfied, ...evidence };
    if (!window.covered || unclassified.length > 0) return { status: VERDICT_STATUS.unknown, ...evidence };
    return { status: VERDICT_STATUS.open, ...evidence };
}
