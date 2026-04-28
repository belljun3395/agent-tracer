import { Inject, Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { BACKFILL_TRIGGER_PORT, RULE_PERSISTENCE_PORT } from "./outbound/tokens.js";
import type { IRulePersistence } from "./outbound/rule.persistence.port.js";
import type {
    BackfillTriggerResult,
    IBackfillTrigger,
} from "./outbound/backfill.trigger.port.js";
import { RuleNotFoundError } from "../common/errors.js";

export interface ReEvaluateRuleUseCaseIn {
    readonly ruleId: string;
}

export type ReEvaluateRuleUseCaseOut = BackfillTriggerResult;

@Injectable()
export class ReEvaluateRuleUseCase {
    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly rules: IRulePersistence,
        @Inject(BACKFILL_TRIGGER_PORT) private readonly backfill: IBackfillTrigger,
    ) {}

    @Transactional()
    async execute(input: ReEvaluateRuleUseCaseIn): Promise<ReEvaluateRuleUseCaseOut> {
        const rule = await this.rules.findById(input.ruleId);
        if (!rule) throw new RuleNotFoundError(input.ruleId);
        return this.backfill.trigger({ rule });
    }
}
