import { Transactional, runOnTransactionCommit } from "typeorm-transactional";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { checkRuleInvariants } from "@monitor/rules-api/rule/domain/rule.invariants.js";
import { computeRuleSignature } from "@monitor/rules-api/rule/domain/rule.signature.js";
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
            type: NOTIFICATION_TYPE.rulesChanged,
            payload: {
                ruleId: created.id,
                change: "created",
                scope: created.scope,
                ...(created.taskId ? { taskId: created.taskId } : {}),
            },
        });

        // 룰 저장이 커밋된 뒤에만 기존 턴 재평가를 시작한다.
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
        // 빈 이름은 목록과 알림에서 식별할 수 없으므로 허용하지 않는다.
        throw new InvalidRuleError("Rule name must not be empty");
    }
    if (input.trigger && input.trigger.phrases.length === 0) {
        // 트리거를 쓰는 룰은 최소 한 문구가 있어야 한다.
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
