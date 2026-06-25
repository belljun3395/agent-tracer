import {
    Controller,
    HttpCode,
    HttpStatus,
    Inject,
    NotFoundException,
    Param,
    Post,
} from "@nestjs/common";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import {
    RuleBackfillService,
    RuleNotFoundForBackfillError,
} from "../application/rule.backfill.service.js";

/**
 * Re-evaluate endpoint. Enqueues a `rule_backfill` job and returns immediately
 * (202) — the {@link RuleBackfillWorker} runs the sweep asynchronously, and the
 * dashboard picks up the new verdicts over the WebSocket `verdict.updated`
 * stream the backfill use-case emits per turn.
 */
@Controller("api/v1/rules")
export class RuleBackfillController {
    constructor(
        @Inject(RuleBackfillService) private readonly service: RuleBackfillService,
    ) {}

    @Post(":id/re-evaluate")
    @HttpCode(HttpStatus.ACCEPTED)
    async reEvaluate(@Param("id", pathParamPipe) id: string) {
        try {
            const job = await this.service.enqueue(id);
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
