import {
    expectFulfilledBy,
    judge,
    observe,
    type EnforcementRecord,
    type Observation,
    type VerdictEvidence,
} from "@monitor/kernel";
import type { EventEntity } from "@monitor/tracer-domain/timeline/event/event.entity.js";
import type { RuleEntity } from "../rule.entity.js";
import { VerdictEntity } from "./verdict.entity.js";

/** 규칙을 낳은 사용자 입력부터 지금까지를 창으로 삼아 규칙 하나의 판정을 전진시킨다. */
export class RuleVerification {
    constructor(
        private readonly rule: RuleEntity,
        private readonly windowEvents: readonly EventEntity[],
    ) {}

    private enforcements(now: string): EnforcementRecord[] {
        const records: EnforcementRecord[] = [];
        for (const event of this.windowEvents) {
            // 규칙의 트리거 증거는 규칙을 낳은 사용자 입력 그 자체다.
            if (this.rule.anchorEventId === event.id) {
                records.push({ eventId: event.id, matchKind: "trigger", decidedAt: now });
            }
            if (expectFulfilledBy(this.rule.expectation, event)) {
                records.push({ eventId: event.id, matchKind: "expect-fulfilled", decidedAt: now });
            }
        }
        return records;
    }

    /** 근거 입력이 창 안에 없으면 아직 이 규칙의 일이 아니다(규칙보다 앞선 턴). */
    covers(): boolean {
        return this.windowEvents.some((event) => event.id === this.rule.anchorEventId);
    }

    /** 원장은 창을 빠짐없이 담으므로 서버 판정은 관측을 놓치지 않는다. */
    advance(current: VerdictEntity | null, turnId: string, now: Date): VerdictEntity | null {
        if (current !== null && !current.isOpen()) return null;

        const observations = this.windowEvents
            .map((event) => observe(event))
            .filter((observation): observation is Observation => observation !== null);
        const judgment = judge(this.rule.expectation, { observations, covered: true });

        const evidence: VerdictEvidence = {
            ...(judgment.expectedPattern !== undefined ? { expectedPattern: judgment.expectedPattern } : {}),
            actualToolCalls: judgment.actualToolCalls,
            matchedToolCalls: judgment.matchedToolCalls,
            unclassifiedEventIds: judgment.unclassifiedEventIds,
            enforcements: this.enforcements(now.toISOString()),
        };

        if (current === null) {
            const verdict = VerdictEntity.open(this.rule.id, turnId, this.rule.severity, evidence, now);
            verdict.advance(turnId, judgment.status, evidence, now);
            return verdict;
        }
        current.advance(turnId, judgment.status, evidence, now);
        return current;
    }
}
