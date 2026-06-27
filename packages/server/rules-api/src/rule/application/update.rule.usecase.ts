import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional } from "typeorm-transactional";
import { isRuleExpectMeaningful } from "@monitor/rules-api/rule/domain/rule.js";
import { computeRuleSignature } from "@monitor/rules-api/rule/domain/rule.signature.js";
import type { RuleExpectInput } from "@monitor/rules-api/rule/domain/type/rule.expectation.input.js";
import {
    NOTIFICATION_PUBLISHER_PORT,
    RULE_PERSISTENCE_PORT,
    VERIFICATION_INVALIDATION_PORT,
} from "./outbound/tokens.js";
import type {
    IRulePersistence,
    RulePersistenceRecord,
    RulePersistenceUpdateInput,
} from "./outbound/rule.persistence.port.js";
import type { IRuleNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type { IVerificationInvalidation } from "./outbound/verification.invalidation.port.js";
import type { UpdateRuleUseCaseIn, UpdateRuleUseCaseOut } from "./dto/update.rule.usecase.dto.js";
import { mapRule } from "./dto/rule.dto.mapper.js";
import { InvalidRuleError, RuleNotFoundError } from "../common/errors.js";

export type { UpdateRuleUseCaseIn, UpdateRuleUseCaseOut } from "./dto/update.rule.usecase.dto.js";
export type { UpdateRuleUseCaseIn as UpdateRuleInput } from "./dto/update.rule.usecase.dto.js";
export type { UpdateRuleUseCaseOut as UpdateRuleResult } from "./dto/update.rule.usecase.dto.js";

@Injectable()
export class UpdateRuleUseCase {
    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly ruleRepo: IRulePersistence,
        @Inject(VERIFICATION_INVALIDATION_PORT) private readonly invalidation: IVerificationInvalidation,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: IRuleNotificationPublisher,
    ) {}

    @Transactional()
    async execute(input: UpdateRuleUseCaseIn): Promise<UpdateRuleUseCaseOut> {
        if (!hasAnyField(input)) {
            // 변경 필드가 없으면 룰 의미가 그대로라 업데이트를 거부한다.
            throw new InvalidRuleError("At least one field must be provided to update");
        }

        const current = await this.ruleRepo.findById(input.id);
        if (!current) throw new RuleNotFoundError(input.id);

        const projectedTrigger = projectTrigger(current.trigger, input.trigger);
        const projectedExpect = projectExpect(current.expect, input.expect);
        if (!isRuleExpectMeaningful(projectedExpect)) {
            // 업데이트 후에도 기대 조건이 하나 이상 남아야 평가 가능한 룰이다.
            throw new InvalidRuleError("Rule expect must include at least one of action, pattern, or commandMatches after update");
        }
        if (input.trigger != null && input.trigger.phrases.length === 0) {
            // 트리거를 유지하려면 최소 한 문구가 있어야 한다.
            throw new InvalidRuleError("Trigger phrases must not be empty when trigger is provided");
        }
        if (input.name !== undefined && input.name.trim() === "") {
            // 빈 이름은 목록과 알림에서 식별할 수 없으므로 허용하지 않는다.
            throw new InvalidRuleError("Rule name must not be empty");
        }

        const newSignature = computeRuleSignature({
            ...(projectedTrigger ? { trigger: projectedTrigger } : {}),
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
            // 트리거/기대 조건이 바뀌면 이전 verdict/enforcement는 더 이상 유효하지 않다.
            await this.invalidation.deleteVerdictsByRuleId(input.id);
            await this.invalidation.deleteEnforcementsByRuleId(input.id);
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
        // rationale을 보낸 경우에는 실제 설명 텍스트가 있어야 한다.
        throw new InvalidRuleError("Rule rationale must not be empty when provided");
    }
    return trimmed;
}

function projectTrigger(
    current: { readonly phrases: readonly string[] } | undefined,
    patch: UpdateRuleUseCaseIn["trigger"],
): { readonly phrases: readonly string[] } | undefined {
    // undefined는 기존 유지, null은 트리거 제거, 객체는 새 트리거로 교체한다.
    if (patch === undefined) return current;
    if (patch === null) return undefined;
    return patch;
}

function projectExpect(
    current: RulePersistenceRecord["expect"],
    patch: UpdateRuleUseCaseIn["expect"],
): RuleExpectInput {
    let action: RuleExpectInput["action"] = current.action;
    let commandMatches: readonly string[] | undefined = current.commandMatches;
    let pattern: string | undefined = current.pattern;

    if (patch !== undefined) {
        // expect 패치는 필드별로 null이면 제거, 값이면 교체한다.
        if (patch.action !== undefined) action = patch.action === null ? undefined : patch.action;
        if (patch.commandMatches !== undefined) {
            commandMatches = patch.commandMatches === null ? undefined : patch.commandMatches;
        }
        if (patch.pattern !== undefined) pattern = patch.pattern === null ? undefined : patch.pattern;
    }

    return { action, commandMatches, pattern };
}
