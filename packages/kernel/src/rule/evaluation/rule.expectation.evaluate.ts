import { commandIncludesAny, compilePattern } from "./rule.pattern.js";
import { normalizeRuleExpectedAction } from "./rule.tool-alias.const.js";
import { VERDICT_STATUS, type VerdictStatus } from "./rule.verdict.js";
import {
    RULE_EXPECTATION_KIND,
    type RuleExpectation,
    type RuleExpectedAction,
    type ToolCall,
} from "../definition/rule.vocabulary.js";

/** 기대 판정 결과와 판정에 사용한 도구 호출 증거다. */
export interface ExpectationOutcome {
    readonly status: VerdictStatus;
    readonly expectedPattern?: string;
    readonly actualToolCalls: string[];
    readonly matchedToolCalls: string[];
}

function commandEvidence(toolCall: ToolCall): string {
    return toolCall.command ?? "";
}

function toolCallEvidence(toolCall: ToolCall): string {
    return toolCall.filePath ?? toolCall.command ?? toolCall.target ?? "";
}

function filterByTool(toolCalls: readonly ToolCall[], tool: RuleExpectedAction | undefined): readonly ToolCall[] {
    return tool === undefined
        ? toolCalls
        : toolCalls.filter((toolCall) => normalizeRuleExpectedAction(toolCall.tool) === tool);
}

/** 한 판정 창의 도구 호출 증거로 규칙 기대의 최종 상태를 계산한다. */
export function evaluateExpectation(exp: RuleExpectation, toolCalls: readonly ToolCall[]): ExpectationOutcome {
    switch (exp.kind) {
        case RULE_EXPECTATION_KIND.command: {
            const actualToolCalls = toolCalls.map(commandEvidence);
            const expectedPattern = exp.commandMatches.join(" | ");
            if (toolCalls.length === 0) {
                return { status: VERDICT_STATUS.contradicted, expectedPattern, actualToolCalls, matchedToolCalls: [] };
            }
            const matched = toolCalls.filter((toolCall) => commandIncludesAny(commandEvidence(toolCall), exp.commandMatches));
            return {
                status: matched.length > 0 ? VERDICT_STATUS.verified : VERDICT_STATUS.contradicted,
                expectedPattern,
                actualToolCalls,
                matchedToolCalls: matched.map(commandEvidence),
            };
        }
        case RULE_EXPECTATION_KIND.pattern: {
            const scoped = filterByTool(toolCalls, exp.tool);
            const actualToolCalls = scoped.map(toolCallEvidence);
            const pattern = compilePattern(exp.pattern);
            if (pattern === null) {
                return {
                    status: VERDICT_STATUS.unverifiable,
                    expectedPattern: exp.pattern,
                    actualToolCalls,
                    matchedToolCalls: [],
                };
            }
            if (scoped.length === 0) {
                return {
                    status: VERDICT_STATUS.contradicted,
                    expectedPattern: exp.pattern,
                    actualToolCalls,
                    matchedToolCalls: [],
                };
            }
            const matched = scoped.filter((toolCall) => pattern.test(toolCallEvidence(toolCall)));
            return {
                status: matched.length > 0 ? VERDICT_STATUS.verified : VERDICT_STATUS.contradicted,
                expectedPattern: exp.pattern,
                actualToolCalls,
                matchedToolCalls: matched.map(toolCallEvidence),
            };
        }
        case RULE_EXPECTATION_KIND.action: {
            const scoped = filterByTool(toolCalls, exp.tool);
            const actualToolCalls = scoped.map(toolCallEvidence);
            return {
                status: scoped.length > 0 ? VERDICT_STATUS.verified : VERDICT_STATUS.contradicted,
                actualToolCalls,
                matchedToolCalls: scoped.length > 0 ? actualToolCalls : [],
            };
        }
    }
}
