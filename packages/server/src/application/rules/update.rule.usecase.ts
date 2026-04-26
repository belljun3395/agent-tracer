import {
    computeRuleSignature,
    isRuleExpectMeaningful,
    type RuleExpectInput,
} from "~domain/verification/index.js";
import type { IRuleRepository, RuleUpdateInput, RuleWithSignature } from "~application/ports/repository/rule.repository.js";
import type { IVerdictRepository } from "~application/ports/repository/verdict.repository.js";
import type { IRuleEnforcementRepository } from "~application/ports/repository/rule.enforcement.repository.js";
import type { INotificationPublisher } from "~application/ports/event/notification.publisher.js";
import type { UpdateRuleUseCaseIn, UpdateRuleUseCaseOut } from "./dto/update.rule.usecase.dto.js";
import { projectRule } from "./rule.projection.js";
import { InvalidRuleError, RuleNotFoundError } from "./common/errors.js";

export type { UpdateRuleUseCaseIn, UpdateRuleUseCaseOut } from "./dto/update.rule.usecase.dto.js";
export type { UpdateRuleUseCaseIn as UpdateRuleInput } from "./dto/update.rule.usecase.dto.js";
export type { UpdateRuleUseCaseOut as UpdateRuleResult } from "./dto/update.rule.usecase.dto.js";

/**
 * Update flow:
 *  1. Compute the projected signature (from patched + current fields).
 *  2. If signature changed → INVALIDATE: delete verdicts + enforcements
 *     for this rule, leave next backfill to user (Re-evaluate button).
 *  3. If signature unchanged → metadata-only update; verdicts kept.
 */
export class UpdateRuleUseCase {
    constructor(
        private readonly ruleRepo: IRuleRepository,
        private readonly verdictRepo: IVerdictRepository,
        private readonly enforcementRepo: IRuleEnforcementRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

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

        const newSignature = computeRuleSignature({
            ...(projectedTrigger ? { trigger: projectedTrigger } : {}),
            expect: projectedExpect,
        });
        const signatureChanged = newSignature !== current.signature;

        const patch: RuleUpdateInput = {
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
            await this.verdictRepo.deleteByRuleId(input.id);
            await this.enforcementRepo.deleteByRuleId(input.id);
        }

        this.notifier.publish({
            type: "rules.changed",
            payload: {
                ruleId: updated.id,
                change: "updated",
                scope: updated.scope,
                ...(updated.taskId ? { taskId: updated.taskId } : {}),
            },
        });

        return { rule: projectRule(updated), signatureChanged };
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
    current: RuleWithSignature["expect"],
    patch: UpdateRuleUseCaseIn["expect"],
): RuleExpectInput {
    let action: RuleExpectInput["action"] = current.action;
    let commandMatches: readonly string[] | undefined = current.commandMatches;
    let pattern: string | undefined = current.pattern;

    if (patch !== undefined) {
        if (patch.action !== undefined) action = patch.action === null ? undefined : patch.action;
        if (patch.commandMatches !== undefined) {
            commandMatches = patch.commandMatches === null ? undefined : patch.commandMatches;
        }
        if (patch.pattern !== undefined) pattern = patch.pattern === null ? undefined : patch.pattern;
    }

    return { action, commandMatches, pattern };
}
