import type { RuleRecordPortDto } from "~application/ports/rules/dto/rule.record.port.dto.js";
import type { RuleUseCaseDto } from "./rule.usecase.dto.js";

export function mapRule(rule: RuleRecordPortDto): RuleUseCaseDto {
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
