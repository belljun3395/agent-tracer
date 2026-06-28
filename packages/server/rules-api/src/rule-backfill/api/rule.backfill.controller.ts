import {
    Controller,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Post,
} from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { RuleNotFoundForBackfillError } from "../service/rule.backfill.service.js";
import { EnqueueRuleBackfillUseCase } from "../application/enqueue.rule.backfill.usecase.js";

@Controller("api/v1/rules")
export class RuleBackfillController {
    constructor(private readonly enqueueBackfill: EnqueueRuleBackfillUseCase) {}

    @Post(":id/re-evaluate")
    @HttpCode(HttpStatus.ACCEPTED)
    async reEvaluate(@Param("id", pathParamPipe) id: string) {
        try {
            return await this.enqueueBackfill.execute(id);
        } catch (err) {
            if (err instanceof RuleNotFoundForBackfillError) {
                throw new NotFoundException(err.message);
            }
            throw err;
        }
    }
}
