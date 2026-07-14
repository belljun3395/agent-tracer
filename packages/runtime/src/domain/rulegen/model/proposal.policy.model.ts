import {RULE_EXPECTED_ACTIONS, RULE_SEVERITIES} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import {buildSeverityGuidance} from "~runtime/domain/rulegen/model/severity.clause.model.js";
import {RULEGEN_MODE, type RulegenMode} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";
import {RULEGEN_TOOL} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

export const RULE_EXPECTATION_FIELD_GUIDE = `  - expect   : { kind, ... } -- kind selects exactly one shape:
               kind="command"  : commandMatches (required, literal commands the agent must run)
               kind="pattern"  : pattern (required regex), tool (optional, narrows which call kind to check)
               kind="action"   : tool (required, one of exactly: ${RULE_EXPECTED_ACTIONS.join(", ")})
               Every rule states what the agent MUST do. A rule cannot state a prohibition.
               Prefer kind="command" (literal commands) over kind="pattern" (regex).`;

const FIELD_GUIDE = `Each rule has:
  - name     : short imperative (under 60 chars)
${RULE_EXPECTATION_FIELD_GUIDE}
  - severity : one of exactly: ${RULE_SEVERITIES.join(", ")} (optional, defaults to "info" if omitted)
  - rationale: 1 short sentence (under 200 chars)`;

/** 모드마다 골라 조립하는 제안 지침 절이다. */
export const GUIDELINE_CLAUSE = {
    obligationsFromRequest: "  - Every rule states one obligation the user's request implies. Split distinct obligations into distinct rules.",
    groundInWorkspace: "  - Ground each obligation in what the repository actually contains: the real test command, the real path. Never invent an obligation the user never asked for.",
    taskSpecific: "  - Lean into patterns specific to THIS task.",
    noOverlapWithExisting: `  - DO NOT propose any rule whose intent or expected action overlaps an existing rule from ${RULEGEN_TOOL.rules}().`,
    zeroIsCorrect: "  - Returning zero rules is correct when there is no verifiable obligation.",
} as const;

const LANGUAGE_DIRECTIVES: Readonly<Record<string, string>> = {
    auto: "Mirror the language of the task (Korean → Korean, English → English, etc.).",
    ko: "Write every rule name and rationale in Korean (한국어).",
    en: "Write every rule name and rationale in English.",
    ja: "Write every rule name and rationale in Japanese (日本語).",
    zh: "Write every rule name and rationale in Simplified Chinese (简体中文).",
};

export function resolveRuleLanguageDirective(language: string): string {
    return LANGUAGE_DIRECTIVES[language] ?? LANGUAGE_DIRECTIVES["auto"]!;
}

function manualCountClause(maxRules: number): string {
    const minRules = Math.min(3, maxRules);
    return minRules === maxRules
        ? `  - Output exactly ${maxRules} rules.`
        : `  - Output exactly ${minRules}-${maxRules} rules.`;
}

function recentCountClause(maxRules: number): string {
    return `  - Output 1-2 rules, never more than ${maxRules}.`;
}

function guidelineClauses(mode: RulegenMode, maxRules: number): readonly string[] {
    if (mode === RULEGEN_MODE.recent) {
        return [
            GUIDELINE_CLAUSE.obligationsFromRequest,
            GUIDELINE_CLAUSE.groundInWorkspace,
            GUIDELINE_CLAUSE.noOverlapWithExisting,
            recentCountClause(maxRules),
            GUIDELINE_CLAUSE.zeroIsCorrect,
        ];
    }
    return [
        GUIDELINE_CLAUSE.obligationsFromRequest,
        GUIDELINE_CLAUSE.groundInWorkspace,
        GUIDELINE_CLAUSE.taskSpecific,
        manualCountClause(maxRules),
        GUIDELINE_CLAUSE.zeroIsCorrect,
    ];
}

export interface RuleProposalPolicyOptions {
    readonly mode: RulegenMode;
    readonly maxRules: number;
    readonly language: string;
    readonly anchorDirective: string;
    readonly intentDirective: string;
}

/** 규칙 제안의 필드와 심각도와 지침과 언어 정책이다. */
export function buildRuleProposalPolicy(options: RuleProposalPolicyOptions): string {
    return [
        FIELD_GUIDE,
        "",
        buildSeverityGuidance(options.mode),
        "",
        "Guidelines:",
        ...guidelineClauses(options.mode, options.maxRules),
        `${options.anchorDirective}${options.intentDirective}`,
        `Output language: ${resolveRuleLanguageDirective(options.language)}`,
    ].join("\n");
}
