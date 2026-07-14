import {isTurnHaltingSeverity} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import {VERDICT_STATUS, aggregateVerdictStatus} from "@monitor/kernel/rule/evaluation/rule.verdict.js";
import type {GuardrailVerdict} from "~runtime/domain/guardrail/model/verdict.model.js";

/** 턴을 붙잡아야 하는 미이행 판정만 고른다. */
export function selectBlockingVerdicts(verdicts: readonly GuardrailVerdict[]): GuardrailVerdict[] {
    return verdicts.filter(
        (verdict) => verdict.status === VERDICT_STATUS.contradicted && isTurnHaltingSeverity(verdict.severity),
    );
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
    const aggregate = aggregateVerdictStatus(verdicts.map((verdict) => verdict.status)) ?? "verified";
    const parts = verdicts.map((verdict) => {
        const expected = verdict.expectedPattern !== undefined ? `, expected ${verdict.expectedPattern}` : "";
        return `'${verdict.ruleName}'=${verdict.status}(${verdict.severity}${expected}, calls=${verdict.actualToolCallCount})`;
    });
    return `[guardrail] task=${taskId} aggregate=${aggregate} :: ${parts.join("; ")}`;
}
