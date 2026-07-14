import {isTurnHaltingSeverity} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import {VERDICT_STATUS, isConfidentVerdict} from "@monitor/kernel/rule/evaluation/rule.verdict.js";
import type {GuardrailVerdict} from "~runtime/domain/guardrail/model/verdict.model.js";

/** 판정 하나에 대해 에이전트에게 무엇을 할지다. */
export const GUARDRAIL_ACTION = {
    /** 이행됐으므로 아무 말도 하지 않는다. */
    silent: "silent",
    /** 지금 막을 자격은 없으므로 다음 요구의 규칙 컨텍스트로 이월해 알린다. */
    carry: "carry",
    /** 미이행을 확신하고 턴을 붙잡을 수 있으므로 지금 막는다. */
    block: "block",
} as const;

export type GuardrailAction = (typeof GUARDRAIL_ACTION)[keyof typeof GUARDRAIL_ACTION];

/** 헛차단은 비싸고 헛질의는 싸므로 막는 데만 확신을 요구한다. */
export function decideAction(verdict: GuardrailVerdict): GuardrailAction {
    if (verdict.status === VERDICT_STATUS.satisfied) return GUARDRAIL_ACTION.silent;
    // 상한만큼 알렸으면 그만 막고 사람에게 넘긴다.
    if (verdict.escalated) return GUARDRAIL_ACTION.carry;
    if (!isConfidentVerdict(verdict.status)) return GUARDRAIL_ACTION.carry;
    return isTurnHaltingSeverity(verdict.severity) ? GUARDRAIL_ACTION.block : GUARDRAIL_ACTION.carry;
}

export function selectBlockingVerdicts(verdicts: readonly GuardrailVerdict[]): GuardrailVerdict[] {
    return verdicts.filter((verdict) => decideAction(verdict) === GUARDRAIL_ACTION.block);
}

/** 턴 차단 시 에이전트 대화에 주입하는 사유 문자열이다. */
export function formatBlockReason(verdicts: readonly GuardrailVerdict[]): string {
    const lines = verdicts.map((verdict, index) => {
        const expected = verdict.expectedPattern !== undefined ? ` — expected: ${verdict.expectedPattern}` : "";
        const seen = `no matching call among the ${verdict.actualToolCallCount} recorded since the request`;
        return `${index + 1}. '${verdict.ruleName}'${expected} — ${seen}`;
    });
    const plural = verdicts.length === 1 ? "rule" : "rules";
    return [
        `You cannot end the turn yet: ${verdicts.length} ${plural} derived from the user's request are still unfulfilled.`,
        ...lines,
        "",
        "Perform the missing actions now, then finish. Claiming you already did them is not evidence — only the recorded tool call is.",
        "If a rule cannot be fulfilled, do the closest thing the user actually asked for and say why in your reply, written in the user's language.",
    ].join("\n");
}

/** 판정 전체를 한 줄로 압축한 운영 로그다. */
export function formatGuardrailLog(taskId: string, verdicts: readonly GuardrailVerdict[]): string {
    const parts = verdicts.map((verdict) => {
        const unclassified = verdict.unclassifiedCount > 0 ? `, opaque=${verdict.unclassifiedCount}` : "";
        return `'${verdict.ruleName}'=${verdict.status}/${decideAction(verdict)}(${verdict.severity}${unclassified}, calls=${verdict.actualToolCallCount})`;
    });
    return `[guardrail] task=${taskId} :: ${parts.join("; ")}`;
}
