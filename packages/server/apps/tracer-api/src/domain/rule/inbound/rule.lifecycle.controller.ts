import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { ApproveRuleUseCase } from "~tracer-api/domain/rule/application/command/approve.rule.usecase.js";
import { ReevaluateRuleUseCase } from "~tracer-api/domain/rule/application/command/reevaluate.rule.usecase.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { reevaluateRuleBodySchema, type ReevaluateRuleBody } from "./rule.lifecycle.schema.js";

/** 규칙 승인과 재평가 HTTP 계약을 제공한다. */
@Controller("api/v1/rules")
export class RuleLifecycleController {
    constructor(
        private readonly approveRule: ApproveRuleUseCase,
        private readonly reevaluateRule: ReevaluateRuleUseCase,
    ) {}

    @Post(":id/approve")
    @HttpCode(HttpStatus.OK)
    async approve(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.approveRule.execute(resolveUserId(user), id);
    }

    @Post(":id/reevaluate")
    @HttpCode(HttpStatus.OK)
    async reevaluate(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(reevaluateRuleBodySchema)) body: ReevaluateRuleBody,
    ) {
        return this.reevaluateRule.execute(
            resolveUserId(user),
            id,
            body?.taskId !== undefined ? { taskId: body.taskId } : undefined,
        );
    }
}
