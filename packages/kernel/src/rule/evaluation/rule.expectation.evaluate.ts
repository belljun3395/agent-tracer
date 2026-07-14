import { commandIncludesAny, compilePattern } from "./rule.pattern.js";
import { normalizeRuleExpectedAction } from "./rule.tool-alias.const.js";
import {
    RULE_EXPECTATION_KIND,
    type RuleExpectation,
    type RuleExpectedAction,
    type ToolCall,
} from "../definition/rule.vocabulary.js";

/** 기대 이행 여부와 판정에 사용한 도구 호출 증거다. */
export interface ExpectationOutcome {
    readonly fulfilled: boolean;
    /** 규칙이 표현한 패턴을 컴파일할 수 없어 이행 여부를 물을 수조차 없다. */
    readonly unverifiable: boolean;
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

function outcome(
    matched: readonly string[],
    actual: readonly string[],
    expectedPattern?: string,
): ExpectationOutcome {
    return {
        fulfilled: matched.length > 0,
        unverifiable: false,
        ...(expectedPattern !== undefined ? { expectedPattern } : {}),
        actualToolCalls: [...actual],
        matchedToolCalls: [...matched],
    };
}

/** 판정 창의 도구 호출 증거로 규칙 기대가 이행됐는지 본다. */
export function evaluateExpectation(exp: RuleExpectation, toolCalls: readonly ToolCall[]): ExpectationOutcome {
    switch (exp.kind) {
        case RULE_EXPECTATION_KIND.command: {
            const actual = toolCalls.map(commandEvidence);
            const matched = toolCalls
                .filter((toolCall) => commandIncludesAny(commandEvidence(toolCall), exp.commandMatches))
                .map(commandEvidence);
            return outcome(matched, actual, exp.commandMatches.join(" | "));
        }
        case RULE_EXPECTATION_KIND.pattern: {
            const scoped = filterByTool(toolCalls, exp.tool);
            const actual = scoped.map(toolCallEvidence);
            const pattern = compilePattern(exp.pattern);
            if (pattern === null) {
                return {
                    fulfilled: false,
                    unverifiable: true,
                    expectedPattern: exp.pattern,
                    actualToolCalls: actual,
                    matchedToolCalls: [],
                };
            }
            const matched = scoped.filter((toolCall) => pattern.test(toolCallEvidence(toolCall))).map(toolCallEvidence);
            return outcome(matched, actual, exp.pattern);
        }
        case RULE_EXPECTATION_KIND.action: {
            const scoped = filterByTool(toolCalls, exp.tool);
            const actual = scoped.map(toolCallEvidence);
            return outcome(actual, actual);
        }
    }
}
