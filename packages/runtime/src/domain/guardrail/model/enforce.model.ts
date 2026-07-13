import {isTurnHaltingSeverity} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import {VERDICT_STATUS, aggregateVerdictStatus} from "@monitor/kernel/rule/evaluation/rule.verdict.js";
import type {PreToolDenial} from "~runtime/domain/guardrail/model/pre-tool.model.js";
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
        const phrase = verdict.matchedPhrase !== undefined ? ` (트리거: "${verdict.matchedPhrase}")` : "";
        const expected = verdict.expectedPattern !== undefined ? ` — 기대 행동: ${verdict.expectedPattern}` : "";
        const detail = verdict.forbiddenPattern !== undefined
            ? ` — 금지 행동 감지: ${verdict.forbiddenPattern}`
            : `${expected} — 이번 턴 도구 호출 ${verdict.actualToolCallCount}건에서 이행 확인 안 됨`;
        return `${index + 1}. '${verdict.ruleName}'${phrase}${detail}`;
    });
    return [
        `사용자의 요구에서 나온 규칙 ${verdicts.length}건이 아직 이행되지 않았습니다:`,
        ...lines,
        "미이행 기대 행동은 지금 수행하고, 금지 행동은 영향을 확인·수습한 뒤 턴을 마치세요.",
    ].join("\n");
}

/** 도구 호출을 사전 거부할 때 에이전트에게 알리는 사유 문자열이다. */
export function formatDenyReason(denial: PreToolDenial): string {
    return `규칙 '${denial.ruleName}'이(가) 이 호출을 금지합니다 (금지 패턴: "${denial.needle}"). 다른 방법을 사용하세요.`;
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
