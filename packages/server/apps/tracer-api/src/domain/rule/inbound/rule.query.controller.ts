import { Controller, Get, Headers, Param, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { GetRuleEvidenceUseCase } from "~tracer-api/domain/rule/application/query/get.rule.evidence.usecase.js";
import { ListRulesUseCase } from "~tracer-api/domain/rule/application/query/list.rules.usecase.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import {
    listRulesQuerySchema,
    ruleEvidenceQuerySchema,
    type ListRulesQuery,
    type RuleEvidenceQuery,
} from "./rule.query.schema.js";

/** 규칙 목록과 판정 근거 조회 HTTP 계약을 제공한다. */
@Controller("api/v1/rules")
export class RuleQueryController {
    constructor(
        private readonly listRules: ListRulesUseCase,
        private readonly getRuleEvidence: GetRuleEvidenceUseCase,
    ) {}

    @Get()
    async list(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(listRulesQuerySchema)) query: ListRulesQuery,
    ) {
        return this.listRules.execute(resolveUserId(user), {
            ...(query.taskId !== undefined ? { taskId: query.taskId } : {}),
            ...(query.scope === "all" ? { all: true } : {}),
        });
    }

    @Get(":ruleId/evidence")
    async evidence(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("ruleId", pathParamPipe) ruleId: string,
        @Query(new SchemaValidationPipe(ruleEvidenceQuerySchema)) query: RuleEvidenceQuery,
    ) {
        return this.getRuleEvidence.execute(resolveUserId(user), ruleId, query.taskId);
    }
}
