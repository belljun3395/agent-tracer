import type {RuleProposalPayload} from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import {
    isEventGrounded,
    isTurnGrounded,
    type RulegenProvenanceSnapshot,
} from "~runtime/domain/rulegen/model/rulegen.provenance.model.js";
import {RULEGEN_TOOL, rulegenToolFullName} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

/** 근거가 서지 않은 출력을 모델에게 되돌려 다시 받는 횟수이며 그 뒤로는 버린다. */
export const RULEGEN_REPAIR_ATTEMPTS = 1;

/** 근거가 선 제안과, 모델에게 돌려줄 거부 사유다. */
export interface RuleGroundingResult {
    readonly grounded: readonly RuleProposalPayload[];
    readonly errors: readonly string[];
}

function groundingErrors(
    proposal: RuleProposalPayload,
    snapshot: RulegenProvenanceSnapshot,
): readonly string[] {
    const errors: string[] = [];
    const unknownTurns = proposal.citedTurnIds.filter((turnId) => !isTurnGrounded(snapshot, turnId));
    if (unknownTurns.length > 0) {
        errors.push(
            `citedTurnIds contains IDs no tool returned in this run: ${unknownTurns.join(", ")}. Cite only turn IDs from ${rulegenToolFullName(RULEGEN_TOOL.turns)}.`,
        );
    } else if (proposal.citedTurnIds.length === 0) {
        errors.push(
            `citedTurnIds is empty. A rule verifies an obligation the user stated, so cite the turn ID it came from (${rulegenToolFullName(RULEGEN_TOOL.turns)}).`,
        );
    }

    const unknownEvents = proposal.citedEventIds.filter((eventId) => !isEventGrounded(snapshot, eventId));
    if (unknownEvents.length > 0) {
        errors.push(
            `citedEventIds contains IDs no tool returned in this run: ${unknownEvents.join(", ")}. Cite only event IDs from ${rulegenToolFullName(RULEGEN_TOOL.events)}.`,
        );
    }
    return errors;
}

/** 도구가 돌려준 적 없는 식별자를 인용한 제안을 걸러내며 오류 문구는 모델이 읽고 고칠 것이다. */
export function groundRuleProposals(
    proposals: readonly RuleProposalPayload[],
    snapshot: RulegenProvenanceSnapshot,
): RuleGroundingResult {
    const grounded: RuleProposalPayload[] = [];
    const errors: string[] = [];
    for (const proposal of proposals) {
        const reasons = groundingErrors(proposal, snapshot);
        if (reasons.length === 0) grounded.push(proposal);
        else errors.push(...reasons.map((reason) => `Rule "${proposal.name}": ${reason}`));
    }
    return {grounded, errors};
}
