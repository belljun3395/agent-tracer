import { Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional } from "typeorm-transactional";
import { isRuleExpectMeaningful, computeRuleSignature } from "@monitor/rules-api/domain/rule/rule.predicates.policy.js";
import type { RuleExpectation } from "@monitor/rules-api/domain/rule/type/rule.expectation.type.js";
import { RuleRepository } from "../../repository/rule/rule.repository.js";
import { VerdictRepository } from "../../repository/verification/verdict.repository.js";
import { RuleEnforcementRepository } from "../../repository/verification/rule.enforcement.repository.js";
import { RuleNotificationPublisherAdapter } from "../../adapter/rule/notification.publisher.adapter.js";
import type {
    RulePersistenceRecord,
    RulePersistenceUpdateInput,
} from "./outbound/rule.persistence.port.js";
import type { UpdateRuleUseCaseIn, UpdateRuleUseCaseOut } from "./dto/update.rule.usecase.dto.js";
import { mapRule } from "./dto/rule.dto.mapper.js";
import { InvalidRuleError, RuleNotFoundError } from "../../domain/rule/errors.js";

export type { UpdateRuleUseCaseIn, UpdateRuleUseCaseOut } from "./dto/update.rule.usecase.dto.js";
export type { UpdateRuleUseCaseIn as UpdateRuleInput } from "./dto/update.rule.usecase.dto.js";
export type { UpdateRuleUseCaseOut as UpdateRuleResult } from "./dto/update.rule.usecase.dto.js";

@Injectable()
export class UpdateRuleUseCase {
    constructor(
        private readonly ruleRepo: RuleRepository,
        private readonly verdicts: VerdictRepository,
        private readonly enforcements: RuleEnforcementRepository,
        private readonly notifier: RuleNotificationPublisherAdapter,
    ) {}

    @Transactional()
    async execute(input: UpdateRuleUseCaseIn): Promise<UpdateRuleUseCaseOut> {
        if (!hasAnyField(input)) {
            throw new InvalidRuleError("At least one field must be provided to update");
        }

        const current = await this.ruleRepo.findById(input.id);
        if (!current) throw new RuleNotFoundError(input.id);

        const projectedTrigger = projectTrigger(current.trigger, input.trigger);
        const projectedExpect = projectExpect(current.expect, input.expect);
        if (!isRuleExpectMeaningful(projectedExpect)) {
            throw new InvalidRuleError("Rule expect must include at least one of action, pattern, or commandMatches after update");
        }
        if (input.trigger != null && input.trigger.phrases.length === 0) {
            throw new InvalidRuleError("Trigger phrases must not be empty when trigger is provided");
        }
        if (input.name !== undefined && input.name.trim() === "") {
            throw new InvalidRuleError("Rule name must not be empty");
        }

        const projectedTriggerOn = input.triggerOn !== undefined
            ? (input.triggerOn ?? undefined)
            : current.triggerOn;

        const newSignature = computeRuleSignature({
            ...(projectedTrigger ? { trigger: projectedTrigger } : {}),
            ...(projectedTriggerOn ? { triggerOn: projectedTriggerOn } : {}),
            expect: projectedExpect,
        });
        const signatureChanged = newSignature !== current.signature;

        const patch: RulePersistenceUpdateInput = {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.severity !== undefined ? { severity: input.severity } : {}),
            ...(input.rationale !== undefined ? { rationale: normalizeOptionalText(input.rationale) } : {}),
            ...(input.triggerOn !== undefined ? { triggerOn: input.triggerOn } : {}),
            ...(input.trigger !== undefined
                ? {
                    trigger: input.trigger === null
                        ? null
                        : { phrases: [...input.trigger.phrases] },
                }
                : {}),
            ...(input.expect !== undefined ? { expect: input.expect } : {}),
        };

        const updated = await this.ruleRepo.update(input.id, patch, newSignature);
        if (!updated) throw new RuleNotFoundError(input.id);

        if (signatureChanged) {
            await this.verdicts.deleteByRuleId(input.id);
            await this.enforcements.deleteByRuleId(input.id);
        }

        this.notifier.publish({
            type: NOTIFICATION_TYPE.rulesChanged,
            payload: {
                ruleId: updated.id,
                change: "updated",
                scope: updated.scope,
                ...(updated.taskId ? { taskId: updated.taskId } : {}),
            },
        });

        return { rule: mapRule(updated), signatureChanged };
    }
}

function hasAnyField(input: UpdateRuleUseCaseIn): boolean {
    return (
        input.name !== undefined ||
        input.trigger !== undefined ||
        input.triggerOn !== undefined ||
        input.expect !== undefined ||
        input.severity !== undefined ||
        input.rationale !== undefined
    );
}

function normalizeOptionalText(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    if (trimmed === "") {
        throw new InvalidRuleError("Rule rationale must not be empty when provided");
    }
    return trimmed;
}

function projectTrigger(
    current: { readonly phrases: readonly string[] } | undefined,
    patch: UpdateRuleUseCaseIn["trigger"],
): { readonly phrases: readonly string[] } | undefined {
    if (patch === undefined) return current;
    if (patch === null) return undefined;
    return patch;
}

function projectExpect(
    current: RulePersistenceRecord["expect"],
    patch: UpdateRuleUseCaseIn["expect"],
): RuleExpectation {
    let action: RuleExpectation["action"] = current.action;
    let commandMatches: readonly string[] | undefined = current.commandMatches;
    let pattern: string | undefined = current.pattern;

    if (patch !== undefined) {
        if (patch.action !== undefined) action = patch.action === null ? undefined : patch.action;
        if (patch.commandMatches !== undefined) {
            commandMatches = patch.commandMatches === null ? undefined : patch.commandMatches;
        }
        if (patch.pattern !== undefined) pattern = patch.pattern === null ? undefined : patch.pattern;
    }

    return {
        ...(action !== undefined ? { action } : {}),
        ...(commandMatches !== undefined ? { commandMatches } : {}),
        ...(pattern !== undefined ? { pattern } : {}),
    };
}
