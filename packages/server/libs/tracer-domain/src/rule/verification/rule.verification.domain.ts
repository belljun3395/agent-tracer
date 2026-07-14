import {
    evaluateExpectation,
    expectFulfilledBy,
    inferToolCall,
    type EnforcementRecord,
    type ToolCall,
    type VerdictEvidence,
} from "@monitor/kernel";
import type { EventEntity } from "@monitor/tracer-domain/timeline/event/event.entity.js";
import type { TurnEntity } from "@monitor/tracer-domain/timeline/turn/turn.entity.js";
import type { RuleEntity } from "../rule.entity.js";
import { VerdictEntity } from "./verdict.entity.js";

/** 규칙을 낳은 사용자 입력부터 지금까지를 창으로 삼아 규칙 하나를 평가한다. */
export class RuleVerification {
    constructor(
        private readonly rule: RuleEntity,
        private readonly turn: TurnEntity,
        private readonly windowEvents: readonly EventEntity[],
    ) {}

    private enforcements(now: string): EnforcementRecord[] {
        const exp = this.rule.expectation;
        const records: EnforcementRecord[] = [];
        for (const event of this.windowEvents) {
            // 규칙의 트리거 증거는 규칙을 낳은 사용자 입력 그 자체다.
            if (this.rule.anchorEventId === event.id) {
                records.push({ eventId: event.id, matchKind: "trigger", decidedAt: now });
            }
            if (expectFulfilledBy(exp, event)) {
                records.push({ eventId: event.id, matchKind: "expect-fulfilled", decidedAt: now });
            }
        }
        return records;
    }

    verdict(now: Date): VerdictEntity | null {
        // 근거 입력이 창 안에 없으면 아직 이 턴의 일이 아니다(규칙보다 앞선 턴).
        if (!this.windowEvents.some((event) => event.id === this.rule.anchorEventId)) return null;

        const toolCalls = this.windowEvents
            .map((event) => inferToolCall(event))
            .filter((tc): tc is ToolCall => tc !== null);
        // 도구 종류 좁히기는 evaluateExpectation이 변형별로 직접 한다.
        const outcome = evaluateExpectation(this.rule.expectation, toolCalls);
        const nowIso = now.toISOString();
        const evidence: VerdictEvidence = {
            ...(outcome.expectedPattern !== undefined ? { expectedPattern: outcome.expectedPattern } : {}),
            actualToolCalls: outcome.actualToolCalls,
            matchedToolCalls: outcome.matchedToolCalls,
            enforcements: this.enforcements(nowIso),
        };
        return VerdictEntity.record(this.turn.id, this.rule.id, outcome.status, evidence, now);
    }
}
