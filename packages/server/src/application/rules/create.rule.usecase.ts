import { randomUUID } from "node:crypto";
import {
    computeRuleSignature,
    isRuleExpectMeaningful,
} from "~domain/verification/index.js";
import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import type { INotificationPublisher } from "~application/ports/event/notification.publisher.js";
import type { BackfillRuleEvaluationUseCase } from "~application/verification/backfill.rule.evaluation.usecase.js";
import type { CreateRuleUseCaseIn, CreateRuleUseCaseOut } from "./dto/create.rule.usecase.dto.js";
import { projectRule } from "./rule.projection.js";
import { InvalidRuleError } from "./common/errors.js";

export type { CreateRuleUseCaseIn, CreateRuleUseCaseOut } from "./dto/create.rule.usecase.dto.js";
export type { CreateRuleUseCaseIn as CreateRuleInput } from "./dto/create.rule.usecase.dto.js";

/**
 * Creates a rule, returns the usecase DTO, and kicks off Backfill so
 * the new rule applies to past closed turns immediately.
 */
export class CreateRuleUseCase {
    constructor(
        private readonly ruleRepo: IRuleRepository,
        private readonly notifier: INotificationPublisher,
        private readonly backfill: BackfillRuleEvaluationUseCase,
        private readonly now: () => string = () => new Date().toISOString(),
    ) {}

    async execute(input: CreateRuleUseCaseIn): Promise<CreateRuleUseCaseOut> {
        validate(input);
        const signature = computeRuleSignature({
            ...(input.trigger ? { trigger: input.trigger } : {}),
            expect: input.expect,
        });
        const id = randomUUID();
        const created = await this.ruleRepo.insert({
            id,
            name: input.name.trim(),
            ...(input.trigger ? { trigger: input.trigger } : {}),
            ...(input.triggerOn ? { triggerOn: input.triggerOn } : {}),
            expect: input.expect,
            scope: input.scope,
            ...(input.taskId ? { taskId: input.taskId } : {}),
            source: input.source ?? "human",
            severity: input.severity ?? "info",
            ...(input.rationale ? { rationale: input.rationale } : {}),
            signature,
            createdAt: this.now(),
        });

        this.notifier.publish({
            type: "rules.changed",
            payload: {
                ruleId: created.id,
                change: "created",
                scope: created.scope,
                ...(created.taskId ? { taskId: created.taskId } : {}),
            },
        });

        // Fire-and-forget backfill — don't block the create response on full
        // historical evaluation. Errors are logged via the surrounding hook.
        void this.backfill.execute({ rule: created });

        return { rule: projectRule(created) };
    }
}

function validate(input: CreateRuleUseCaseIn): void {
    if (input.name.trim() === "") {
        throw new InvalidRuleError("Rule name must not be empty");
    }
    if (input.trigger && input.trigger.phrases.length === 0) {
        throw new InvalidRuleError("Trigger phrases must not be empty when trigger is provided");
    }
    if (!isRuleExpectMeaningful(input.expect)) {
        throw new InvalidRuleError("Rule expect must include at least one of action, pattern, or commandMatches");
    }
    if (input.scope === "task" && !input.taskId) {
        throw new InvalidRuleError("Task-scoped rules must have a taskId");
    }
    if (input.scope === "global" && input.taskId) {
        throw new InvalidRuleError("Global rules must not have a taskId");
    }
}
