import { Transactional, runOnTransactionCommit } from "typeorm-transactional";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { isRuleExpectMeaningful } from "~governance/rule/domain/rule.js";
import { computeRuleSignature } from "~governance/rule/domain/rule.signature.js";
import {
    BACKFILL_TRIGGER_PORT,
    CLOCK_PORT,
    ID_GENERATOR_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    RULE_PERSISTENCE_PORT,
} from "./outbound/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IIdGenerator } from "./outbound/id.generator.port.js";
import type { IRulePersistence } from "./outbound/rule.persistence.port.js";
import type { IRuleNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type { IBackfillTrigger } from "./outbound/backfill.trigger.port.js";
import type { CreateRuleUseCaseIn, CreateRuleUseCaseOut } from "./dto/create.rule.usecase.dto.js";
import { mapRule } from "./dto/rule.dto.mapper.js";
import { InvalidRuleError } from "../common/errors.js";

export type { CreateRuleUseCaseIn, CreateRuleUseCaseOut } from "./dto/create.rule.usecase.dto.js";
export type { CreateRuleUseCaseIn as CreateRuleInput } from "./dto/create.rule.usecase.dto.js";

/**
 * Creates a rule, returns the usecase DTO, and kicks off Backfill so
 * the new rule applies to past closed turns immediately.
 */
@Injectable()
export class CreateRuleUseCase {
    private readonly logger = new Logger(CreateRuleUseCase.name);

    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly ruleRepo: IRulePersistence,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: IRuleNotificationPublisher,
        @Inject(BACKFILL_TRIGGER_PORT) private readonly backfill: IBackfillTrigger,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
    ) {}

    @Transactional()
    async execute(input: CreateRuleUseCaseIn): Promise<CreateRuleUseCaseOut> {
        validate(input);
        const signature = computeRuleSignature({
            ...(input.trigger ? { trigger: input.trigger } : {}),
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
            type: "rules.changed",
            payload: {
                ruleId: created.id,
                change: "created",
                scope: created.scope,
                ...(created.taskId ? { taskId: created.taskId } : {}),
            },
        });

        // Backfill must run as its OWN top-level transaction, AFTER this one
        // commits. Triggering it inline runs it inside the write-serializer's
        // holds-lock async context, so the serializer mistakes it for a nested
        // savepoint and lets it run detached (it is not awaited); this
        // transaction then commits out from under it, destroying the savepoint
        // it expects ("no such savepoint: typeorm_1") and crashing the process
        // via an unhandled rejection. Deferring to commit gives backfill a clean
        // context + the FIFO write lock; a rollback skips it entirely.
        runOnTransactionCommit(() => {
            void this.backfill.trigger({ rule: created }).catch((err: unknown) => {
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
