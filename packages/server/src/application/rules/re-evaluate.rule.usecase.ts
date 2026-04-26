import type { RuleReadPort } from "~application/ports/rules/rule.read.port.js";
import type { BackfillRuleEvaluationUseCase } from "~application/verification/backfill.rule.evaluation.usecase.js";
import type { BackfillRuleEvaluationUseCaseOut } from "~application/verification/dto/backfill.rule.evaluation.usecase.dto.js";
import { RuleNotFoundError } from "./common/errors.js";

export interface ReEvaluateRuleUseCaseIn {
    readonly ruleId: string;
}

export type ReEvaluateRuleUseCaseOut = BackfillRuleEvaluationUseCaseOut;

export class ReEvaluateRuleUseCase {
    constructor(
        private readonly rules: RuleReadPort,
        private readonly backfill: BackfillRuleEvaluationUseCase,
    ) {}

    async execute(input: ReEvaluateRuleUseCaseIn): Promise<ReEvaluateRuleUseCaseOut> {
        const rule = await this.rules.findById(input.ruleId);
        if (!rule) throw new RuleNotFoundError(input.ruleId);
        return this.backfill.execute({ rule });
    }
}
