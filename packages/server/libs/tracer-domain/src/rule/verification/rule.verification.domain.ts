import {
    evaluateExpectation,
    eventSpeaker,
    expectFulfilledBy,
    findTriggerPhrase,
    inferToolCall,
    type EnforcementRecord,
    type RuleTrigger,
    type ToolCall,
    type VerdictEvidence,
} from "@monitor/kernel";
import type { EventEntity } from "@monitor/tracer-domain/timeline/event/event.entity.js";
import type { TurnEntity } from "@monitor/tracer-domain/timeline/turn/turn.entity.js";
import type { RuleEntity } from "../rule.entity.js";
import { VerdictEntity } from "./verdict.entity.js";

/**
 * 하나의 규칙을 판정 창에 대해 평가하며, anchor된 규칙은 근거 입력부터 지금 턴 끝까지를 창으로 쓰고 anchor가 없는 규칙은 트리거 문구가 발화된 턴만 판정한다.
 */
export class RuleVerification {
    constructor(
        private readonly rule: RuleEntity,
        private readonly turn: TurnEntity,
        private readonly windowEvents: readonly EventEntity[],
    ) {}

    private activeTrigger(): RuleTrigger | null {
        if (this.rule.isAnchored()) return null;
        const trigger = this.rule.trigger;
        return trigger.phrases.length > 0 ? trigger : null;
    }

    private enforcements(now: string, matchedPhrase: string | null): EnforcementRecord[] {
        const trigger = this.activeTrigger();
        const exp = this.rule.expectation;
        const records: EnforcementRecord[] = [];
        for (const event of this.windowEvents) {
            // anchor된 규칙의 트리거 증거는 근거가 된 사용자 입력 그 자체다.
            if (this.rule.anchorEventId === event.id) {
                records.push({ eventId: event.id, matchKind: "trigger", decidedAt: now });
            } else if (trigger !== null && matchedPhrase !== null) {
                const text = `${event.title}\n${event.body ?? ""}`;
                const speaker = eventSpeaker(event.kind);
                if (findTriggerPhrase(trigger, [{ speaker, text }], false) !== null) {
                    records.push({ eventId: event.id, matchKind: "trigger", decidedAt: now });
                }
            }
            if (expectFulfilledBy(exp, event)) {
                records.push({ eventId: event.id, matchKind: "expect-fulfilled", decidedAt: now });
            }
        }
        return records;
    }

    verdict(now: Date): VerdictEntity | null {
        // anchor된 규칙은 근거 입력이 창 안에 없으면 아직 이 턴의 일이 아니다(규칙보다 앞선 턴).
        if (this.rule.isAnchored()) {
            if (!this.windowEvents.some((event) => event.id === this.rule.anchorEventId)) return null;
        }

        const trigger = this.activeTrigger();
        const candidates = [
            { speaker: "user" as const, text: this.turn.askedText ?? "" },
            { speaker: "assistant" as const, text: this.turn.assistantText ?? "" },
        ];
        // 트리거가 있는데 발화되지 않았으면 판정하지 않는다.
        const matchedPhrase = trigger !== null ? findTriggerPhrase(trigger, candidates, true) : null;
        if (trigger !== null && matchedPhrase === null) return null;

        const exp = this.rule.expectation;
        const toolCalls = this.windowEvents
            .map((event) => inferToolCall(event))
            .filter((tc): tc is ToolCall => tc !== null);
        // 도구 종류 좁히기는 evaluateExpectation이 변형별로 직접 한다.
        const outcome = evaluateExpectation(exp, toolCalls);
        const nowIso = now.toISOString();
        const evidence: VerdictEvidence = {
            ...(matchedPhrase !== null ? { matchedPhrase } : {}),
            ...(outcome.expectedPattern !== undefined ? { expectedPattern: outcome.expectedPattern } : {}),
            ...(outcome.forbiddenPattern !== undefined ? { forbiddenPattern: outcome.forbiddenPattern } : {}),
            actualToolCalls: outcome.actualToolCalls,
            matchedToolCalls: outcome.matchedToolCalls,
            enforcements: this.enforcements(nowIso, matchedPhrase),
        };
        return VerdictEntity.record(this.turn.id, this.rule.id, outcome.status, evidence, now);
    }
}
