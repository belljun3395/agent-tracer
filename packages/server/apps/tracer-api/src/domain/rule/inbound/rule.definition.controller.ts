import { Body, Controller, Delete, Headers, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
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
@Controller("api/v1/rules")
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
            ...(body.trigger !== undefined
                ? {
                      trigger: {
                          phrases: body.trigger.phrases,
                          ...(body.triggerOn !== undefined ? { on: body.triggerOn } : {}),
                      },
                  }
                : {}),
            expectation: body.expect,
            scope: body.scope,
            ...(body.taskId !== undefined ? { taskId: body.taskId } : {}),
            ...(body.severity !== undefined ? { severity: body.severity } : {}),
            ...(body.rationale !== undefined ? { rationale: body.rationale } : {}),
            ...(body.anchorEventId !== undefined ? { anchorEventId: body.anchorEventId } : {}),
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
            ...(body.trigger !== undefined
                ? {
                      trigger: {
                          phrases: body.trigger?.phrases ?? [],
                          ...(body.triggerOn !== undefined && body.triggerOn !== null
                              ? { on: body.triggerOn }
                              : {}),
                      },
                  }
                : {}),
            ...(body.expect !== undefined ? { expectation: body.expect } : {}),
            ...(body.scope !== undefined ? { scope: body.scope } : {}),
            ...(body.taskId !== undefined ? { taskId: body.taskId } : {}),
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
