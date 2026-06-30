import { Transactional, runOnTransactionCommit } from "typeorm-transactional";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { checkRuleInvariants } from "@monitor/rules-api/domain/rule/rule.invariants.policy.js";
import { computeRuleSignature } from "@monitor/rules-api/domain/rule/rule.predicates.policy.js";
import { CLOCK_PORT, ID_GENERATOR_PORT } from "./outbound/tokens.js";
import { RuleRepository } from "../../repository/rule/rule.repository.js";
import { RuleNotificationPublisherAdapter } from "../../adapter/rule/notification.publisher.adapter.js";
import { BackfillRuleEvaluationUseCase } from "@monitor/rules-api/application/verification/backfill.rule.evaluation.usecase.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IIdGenerator } from "./outbound/id.generator.port.js";
import type { CreateRuleUseCaseIn, CreateRuleUseCaseOut } from "./dto/create.rule.usecase.dto.js";
import { mapRule } from "./dto/rule.dto.mapper.js";
import { InvalidRuleError } from "../../domain/rule/errors.js";

export type { CreateRuleUseCaseIn, CreateRuleUseCaseOut } from "./dto/create.rule.usecase.dto.js";
export type { CreateRuleUseCaseIn as CreateRuleInput } from "./dto/create.rule.usecase.dto.js";

@Injectable()
export class CreateRuleUseCase {
    private readonly logger = new Logger(CreateRuleUseCase.name);

    constructor(
        private readonly ruleRepo: RuleRepository,
        private readonly notifier: RuleNotificationPublisherAdapter,
        private readonly backfill: BackfillRuleEvaluationUseCase,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
    ) {}

    @Transactional()
    async execute(input: CreateRuleUseCaseIn): Promise<CreateRuleUseCaseOut> {
        validate(input);
        const signature = input.signature ?? computeRuleSignature({
            ...(input.trigger ? { trigger: input.trigger } : {}),
            ...(input.triggerOn ? { triggerOn: input.triggerOn } : {}),
            expect: input.expect,
        });
        const id = this.idGen.newUuid();
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
            createdAt: this.clock.nowIso(),
        });

        this.notifier.publish({
            type: NOTIFICATION_TYPE.rulesChanged,
            payload: {
                ruleId: created.id,
                change: "created",
                scope: created.scope,
                ...(created.taskId ? { taskId: created.taskId } : {}),
            },
        });

        runOnTransactionCommit(() => {
            void this.backfill.execute({ rule: created }).catch((err: unknown) => {
                this.logger.error(
                    `Backfill failed for rule ${created.id}: ${
                        err instanceof Error ? err.message : String(err)
                    }`,
                );
            });
        });

        return { rule: mapRule(created) };
    }
}

function validate(input: CreateRuleUseCaseIn): void {
    if (input.name.trim() === "") {
        throw new InvalidRuleError("Rule name must not be empty");
    }
    if (input.trigger && input.trigger.phrases.length === 0) {
        throw new InvalidRuleError("Trigger phrases must not be empty when trigger is provided");
    }
    const [violation] = checkRuleInvariants({
        scope: input.scope,
        ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
        expect: input.expect,
    });
    if (violation) {
        throw new InvalidRuleError(violation.message);
    }
}
