import type { RulePersistenceRecord } from "../outbound/rule.persistence.port.js";
import type {
    RuleExpectedActionUseCaseDto,
    RuleSourceUseCaseDto,
    RuleTriggerSourceUseCaseDto,
    RuleUseCaseDto,
} from "./rule.usecase.dto.js";

export function mapRule(rule: RulePersistenceRecord): RuleUseCaseDto {
    return {
        id: rule.id,
        name: rule.name,
        ...(rule.trigger !== undefined ? { trigger: rule.trigger } : {}),
        ...(rule.triggerOn !== undefined ? { triggerOn: rule.triggerOn as RuleTriggerSourceUseCaseDto } : {}),
        expect: {
            ...(rule.expect.action !== undefined ? { tool: rule.expect.action as RuleExpectedActionUseCaseDto } : {}),
            ...(rule.expect.commandMatches !== undefined
                ? { commandMatches: rule.expect.commandMatches }
                : {}),
            ...(rule.expect.pattern !== undefined ? { pattern: rule.expect.pattern } : {}),
        },
        scope: rule.scope,
        ...(rule.taskId !== undefined ? { taskId: rule.taskId } : {}),
        source: rule.source as RuleSourceUseCaseDto,
        severity: rule.severity,
        ...(rule.rationale !== undefined ? { rationale: rule.rationale } : {}),
        signature: rule.signature,
        createdAt: rule.createdAt,
    };
}
