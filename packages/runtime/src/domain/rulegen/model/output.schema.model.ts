import {
    RULE_EXPECTATION_KIND,
    RULE_EXPECTED_ACTIONS,
    RULE_SEVERITIES,
    RULE_TRIGGER_SOURCES,
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
                        trigger: {
                            type: "object",
                            properties: {
                                phrases: {type: "array", items: {type: "string"}},
                            },
                        },
                        triggerOn: {type: "string", enum: [...RULE_TRIGGER_SOURCES]},
                        expect: {
                            type: "object",
                            oneOf: [
                                {
                                    type: "object",
                                    properties: {
                                        kind: {type: "string", enum: [RULE_EXPECTATION_KIND.command]},
                                        commandMatches: {type: "array", items: {type: "string"}},
                                        forbiddenMatches: {type: "array", items: {type: "string"}},
                                    },
                                    required: ["kind", "commandMatches"],
                                },
                                {
                                    type: "object",
                                    properties: {
                                        kind: {type: "string", enum: [RULE_EXPECTATION_KIND.pattern]},
                                        pattern: {type: "string"},
                                        tool: {type: "string", enum: [...RULE_EXPECTED_ACTIONS]},
                                        forbiddenMatches: {type: "array", items: {type: "string"}},
                                    },
                                    required: ["kind", "pattern"],
                                },
                                {
                                    type: "object",
                                    properties: {
                                        kind: {type: "string", enum: [RULE_EXPECTATION_KIND.action]},
                                        tool: {type: "string", enum: [...RULE_EXPECTED_ACTIONS]},
                                        forbiddenMatches: {type: "array", items: {type: "string"}},
                                    },
                                    required: ["kind", "tool"],
                                },
                                {
                                    type: "object",
                                    properties: {
                                        kind: {type: "string", enum: [RULE_EXPECTATION_KIND.forbidden]},
                                        forbiddenMatches: {type: "array", items: {type: "string"}},
                                    },
                                    required: ["kind", "forbiddenMatches"],
                                },
                            ],
                        },
                        severity: {type: "string", enum: [...RULE_SEVERITIES]},
                        rationale: {type: "string"},
                    },
                    required: ["name", "expect", "rationale"],
                },
            },
        },
        required: ["rules"],
    };
}
