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
 * 룰 재평가 엔드포인트. 같은 요청 안에서 재평가 스윕을 실행하고 완료된 잡을
 * 반환한다. 새 verdict 는 WebSocket `verdict.updated` 스트림으로도 전달된다.
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
