import { RULE_EXPECTATION_KIND, type RuleExpectation } from "@monitor/kernel";
import type { RuleEntity } from "@monitor/tracer-domain";

export interface SlimRule {
    readonly id: string;
    readonly name: string;
    readonly expect: Record<string, unknown>;
    readonly taskId: string;
    readonly anchorEventId: string;
    readonly source: string;
    readonly severity: string;
    readonly rationale: string | null;
    readonly signature: string;
    readonly createdAt: string;
}

/** 규칙 엔티티를 모델 입력 뷰로 바꾼다. */
export function toSlimRule(rule: RuleEntity): SlimRule {
    return {
        id: rule.id,
        name: rule.name,
        expect: toExpectView(rule.expectation),
        taskId: rule.taskId,
        anchorEventId: rule.anchorEventId,
        source: rule.source,
        severity: rule.severity,
        rationale: rule.rationale,
        signature: rule.signature,
        createdAt: rule.createdAt.toISOString(),
    };
}

function toExpectView(expectation: RuleExpectation): Record<string, unknown> {
    switch (expectation.kind) {
        case RULE_EXPECTATION_KIND.command:
            return { kind: expectation.kind, commandMatches: expectation.commandMatches };
        case RULE_EXPECTATION_KIND.pattern:
            return {
                kind: expectation.kind,
                pattern: expectation.pattern,
                ...(expectation.tool !== undefined ? { action: expectation.tool } : {}),
            };
        case RULE_EXPECTATION_KIND.action:
            return { kind: expectation.kind, action: expectation.tool };
    }
}
