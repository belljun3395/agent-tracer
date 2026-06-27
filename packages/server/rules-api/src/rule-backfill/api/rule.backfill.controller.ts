import {
    Controller,
    HttpCode,
    HttpStatus,
    Inject,
    NotFoundException,
    Param,
    Post,
} from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import {
    RuleBackfillService,
    RuleNotFoundForBackfillError,
} from "../application/rule.backfill.service.js";

@Controller("api/v1/rules")
export class RuleBackfillController {
    constructor(
        @Inject(RuleBackfillService) private readonly service: RuleBackfillService,
    ) {}

    @Post(":id/re-evaluate")
    @HttpCode(HttpStatus.ACCEPTED)
    async reEvaluate(@Param("id", pathParamPipe) id: string) {
        try {
            const job = await this.service.run(id);
            return {
                jobId: job.id,
                status: job.status,
                ruleId: job.ruleId,
                createdAt: job.createdAt,
            };
        } catch (err) {
            if (err instanceof RuleNotFoundForBackfillError) {
                throw new NotFoundException(err.message);
            }
            throw err;
        }
    }
}
