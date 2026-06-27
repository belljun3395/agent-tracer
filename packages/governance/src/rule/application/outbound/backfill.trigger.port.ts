/**
 * 아웃바운드 포트 — 단일 룰에 대한 verification 백필을 트리거한다.
 * 룰 모듈이 생성/수정/재평가 후 호출하면, verification 모듈이 변경된 룰로
 * 닫힌 턴들을 재평가한다.
 *
 * 룰 페이로드는 룰 모듈 자신의 public Rule 계약을 그대로 사용한다.
 */
import type { Rule } from "@monitor/governance/rule/public/types/rule.types.js";

export interface BackfillTriggerInput {
    readonly rule: Rule;
}

export interface BackfillTriggerResult {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}

export interface IBackfillTrigger {
    trigger(input: BackfillTriggerInput): Promise<BackfillTriggerResult>;
}
