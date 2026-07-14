import { Body, Controller, Delete, Headers, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER, RULES_PATH } from "@monitor/kernel";
import { CreateRuleUseCase } from "~tracer-api/domain/rule/application/command/create.rule.usecase.js";
import { DeleteRuleUseCase } from "~tracer-api/domain/rule/application/command/delete.rule.usecase.js";
import { UpdateRuleUseCase } from "~tracer-api/domain/rule/application/command/update.rule.usecase.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import {
    createRuleBodySchema,
    updateRuleBodySchema,
    type CreateRuleBody,
    type UpdateRuleBody,
} from "./rule.definition.schema.js";

/** 규칙 정의 생성·수정·삭제 HTTP 계약을 제공한다. */
@Controller(RULES_PATH)
export class RuleDefinitionController {
    constructor(
        private readonly createRule: CreateRuleUseCase,
        private readonly updateRule: UpdateRuleUseCase,
        private readonly deleteRule: DeleteRuleUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(createRuleBodySchema)) body: CreateRuleBody,
    ) {
        return this.createRule.execute({
            userId: resolveUserId(user),
            name: body.name,
            expectation: body.expect,
            taskId: body.taskId,
            anchorEventId: body.anchorEventId,
            ...(body.severity !== undefined ? { severity: body.severity } : {}),
            ...(body.rationale !== undefined ? { rationale: body.rationale } : {}),
        });
    }

    @Patch(":id")
    async update(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(updateRuleBodySchema)) body: UpdateRuleBody,
    ) {
        return this.updateRule.execute({
            userId: resolveUserId(user),
            id,
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.expect !== undefined ? { expectation: body.expect } : {}),
            ...(body.severity !== undefined ? { severity: body.severity } : {}),
            ...(body.rationale !== undefined ? { rationale: body.rationale } : {}),
        });
    }

    @Delete(":id")
    @HttpCode(HttpStatus.OK)
    async remove(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.deleteRule.execute(resolveUserId(user), id);
    }
}
