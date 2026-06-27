import { Controller, Get, Inject, Param } from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { GetRuleEvidenceForTaskUseCase } from "../application/get.rule.evidence.usecase.js";

@Controller("api/v1/tasks/:taskId/rules/:ruleId")
export class RuleEvidenceQueryController {
    constructor(
        @Inject(GetRuleEvidenceForTaskUseCase)
        private readonly getEvidence: GetRuleEvidenceForTaskUseCase,
    ) {}

    @Get("evidence")
    async evidence(
        @Param("taskId", pathParamPipe) taskId: string,
        @Param("ruleId", pathParamPipe) ruleId: string,
    ) {
        return this.getEvidence.execute({ taskId, ruleId });
    }
}
