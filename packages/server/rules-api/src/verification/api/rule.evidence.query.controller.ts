import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { GetRuleEvidenceForTaskUseCase } from "../application/get.rule.evidence.usecase.js";

// Rule evidence for a task — served under the rules namespace (ruleId in path,
// taskId in query) so /tasks stays run-owned.
@Controller("api/v1/rules/:ruleId")
export class RuleEvidenceQueryController {
    constructor(
        @Inject(GetRuleEvidenceForTaskUseCase)
        private readonly getEvidence: GetRuleEvidenceForTaskUseCase,
    ) {}

    @Get("evidence")
    async evidence(
        @Param("ruleId", pathParamPipe) ruleId: string,
        @Query("taskId", pathParamPipe) taskId: string,
    ) {
        return this.getEvidence.execute({ taskId, ruleId });
    }
}
