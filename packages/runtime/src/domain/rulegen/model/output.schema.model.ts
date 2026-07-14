import {
    RULE_EXPECTATION_KIND,
    RULE_EXPECTED_ACTIONS,
    RULE_SEVERITIES,
} from "@monitor/kernel/rule/definition/rule.vocabulary.js";

/** 구조화 출력으로 받는 규칙 제안의 유일한 JSON 스키마다. */
export function buildRuleOutputSchema(): Record<string, unknown> {
    return {
        type: "object",
        properties: {
            rules: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        name: {type: "string"},
                        expect: {
                            type: "object",
                            oneOf: [
                                {
                                    type: "object",
                                    properties: {
                                        kind: {type: "string", enum: [RULE_EXPECTATION_KIND.command]},
                                        commandMatches: {type: "array", items: {type: "string"}},
                                    },
                                    required: ["kind", "commandMatches"],
                                },
                                {
                                    type: "object",
                                    properties: {
                                        kind: {type: "string", enum: [RULE_EXPECTATION_KIND.pattern]},
                                        pattern: {type: "string"},
                                        tool: {type: "string", enum: [...RULE_EXPECTED_ACTIONS]},
                                    },
                                    required: ["kind", "pattern"],
                                },
                                {
                                    type: "object",
                                    properties: {
                                        kind: {type: "string", enum: [RULE_EXPECTATION_KIND.action]},
                                        tool: {type: "string", enum: [...RULE_EXPECTED_ACTIONS]},
                                    },
                                    required: ["kind", "tool"],
                                },
                            ],
                        },
                        severity: {type: "string", enum: [...RULE_SEVERITIES]},
                        rationale: {type: "string"},
                    },
                    // 수용 계약(kernel의 ruleProposalSchema)이 rationale을 선택으로 두므로 구조화 출력도 강제하지 않는다.
                    required: ["name", "expect"],
                },
            },
        },
        required: ["rules"],
    };
}
