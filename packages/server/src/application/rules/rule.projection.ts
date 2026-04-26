import type { RuleWithSignature } from "~application/ports/repository/rule.repository.js";

type RuleExpectedActionOutputDto = "command" | "file-read" | "file-write" | "web";
type RuleScopeOutputDto = "global" | "task";
type RuleSeverityOutputDto = "info" | "warn" | "block";
type RuleSourceOutputDto = "human" | "agent";
type RuleTriggerSourceOutputDto = "assistant" | "user";

interface RuleOutputDto {
    readonly id: string;
    readonly name: string;
    readonly trigger?: { readonly phrases: readonly string[] };
    readonly triggerOn?: RuleTriggerSourceOutputDto;
    readonly expect: {
        readonly tool?: RuleExpectedActionOutputDto;
        readonly commandMatches?: readonly string[];
        readonly pattern?: string;
    };
    readonly scope: RuleScopeOutputDto;
    readonly taskId?: string;
    readonly source: RuleSourceOutputDto;
    readonly severity: RuleSeverityOutputDto;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export function projectRule(rule: RuleWithSignature): RuleOutputDto {
    return {
        id: rule.id,
        name: rule.name,
        ...(rule.trigger !== undefined ? { trigger: rule.trigger } : {}),
        ...(rule.triggerOn !== undefined ? { triggerOn: rule.triggerOn } : {}),
        expect: {
            ...(rule.expect.action !== undefined ? { tool: rule.expect.action } : {}),
            ...(rule.expect.commandMatches !== undefined
                ? { commandMatches: rule.expect.commandMatches }
                : {}),
            ...(rule.expect.pattern !== undefined ? { pattern: rule.expect.pattern } : {}),
        },
        scope: rule.scope,
        ...(rule.taskId !== undefined ? { taskId: rule.taskId } : {}),
        source: rule.source,
        severity: rule.severity,
        ...(rule.rationale !== undefined ? { rationale: rule.rationale } : {}),
        signature: rule.signature,
        createdAt: rule.createdAt,
    };
}
