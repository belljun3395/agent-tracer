import type { Rule, RuleScope, RuleSource, RuleSeverity, RuleTriggerSource } from "~domain/verification/index.js";

export interface RuleRow {
    readonly id: string;
    readonly name: string;
    readonly trigger_phrases_json: string | null;
    readonly trigger_on: string | null;
    readonly expect_tool: string | null;
    readonly expect_command_matches_json: string | null;
    readonly expect_pattern: string | null;
    readonly scope: string;
    readonly task_id: string | null;
    readonly source: string;
    readonly severity: string;
    readonly rationale: string | null;
    readonly created_at: string;
}

function parseStringArray(value: string | null): readonly string[] | undefined {
    if (value === null) return undefined;
    try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
            return parsed;
        }
    } catch {
        // fall through
    }
    return undefined;
}

export function mapRuleRow(row: RuleRow): Rule {
    const phrases = parseStringArray(row.trigger_phrases_json);
    const commandMatches = parseStringArray(row.expect_command_matches_json);

    const expect: Rule["expect"] = {
        ...(row.expect_tool !== null ? { tool: row.expect_tool } : {}),
        ...(commandMatches !== undefined ? { commandMatches } : {}),
        ...(row.expect_pattern !== null ? { pattern: row.expect_pattern } : {}),
    };

    const triggerOn: RuleTriggerSource | undefined = row.trigger_on === "user" || row.trigger_on === "assistant"
        ? row.trigger_on
        : undefined;

    return {
        id: row.id,
        name: row.name,
        ...(phrases !== undefined ? { trigger: { phrases } } : {}),
        ...(triggerOn !== undefined ? { triggerOn } : {}),
        expect,
        scope: row.scope as RuleScope,
        ...(row.task_id !== null ? { taskId: row.task_id } : {}),
        source: row.source as RuleSource,
        severity: row.severity as RuleSeverity,
        ...(row.rationale !== null ? { rationale: row.rationale } : {}),
        createdAt: row.created_at,
    };
}
