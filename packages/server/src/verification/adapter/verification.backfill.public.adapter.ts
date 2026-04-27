import { Inject, Injectable } from "@nestjs/common";
import { BackfillRuleEvaluationUseCase } from "../application/backfill.rule.evaluation.usecase.js";
import type {
    IVerificationBackfill,
    VerificationBackfillResult,
    VerificationBackfillRule,
} from "../public/iservice/verification.backfill.iservice.js";

/** Public adapter — implements IVerificationBackfill via the internal usecase. */
@Injectable()
export class VerificationBackfillPublicAdapter implements IVerificationBackfill {
    constructor(
        @Inject(BackfillRuleEvaluationUseCase) private readonly inner: BackfillRuleEvaluationUseCase,
    ) {}

    async backfill(rule: VerificationBackfillRule): Promise<VerificationBackfillResult> {
        const result = await this.inner.execute({ rule: rule as never });
        return {
            turnsConsidered: result.turnsConsidered,
            turnsEvaluated: result.turnsEvaluated,
            verdictsCreated: result.verdictsCreated,
        };
    }
}
