import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Inject,
    NotFoundException,
    Param,
    Patch,
    Post,
} from "@nestjs/common";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import {
    CreateRuleUseCase,
    DeleteRuleUseCase,
    InvalidRuleInputError,
    InvalidRuleUpdateError,
    PromoteRuleToGlobalUseCase,
    RuleNotFoundError,
    UpdateRuleUseCase,
} from "~application/rules/index.js";
import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import { BackfillRuleEvaluationUseCase } from "~application/verification/backfill.rule.evaluation.usecase.js";
import { buildRuleExpect } from "~domain/verification/index.js";
import { createApiErrorEnvelope } from "~main/presentation/interceptors/api-response-envelope.js";
import { RULE_REPOSITORY_TOKEN } from "~main/presentation/database/database.provider.js";
import {
    createRuleBodySchema,
    promoteRuleBodySchema,
    updateRuleBodySchema,
    type CreateRuleBody,
    type PromoteRuleBody,
    type UpdateRuleBody,
} from "~adapters/http/ingest/schemas/rules.write.schema.js";

@Controller("api/v1/rules")
export class RuleCommandController {
    constructor(
        @Inject(CreateRuleUseCase)
        private readonly createRule: CreateRuleUseCase,
        @Inject(DeleteRuleUseCase)
        private readonly deleteRule: DeleteRuleUseCase,
        @Inject(UpdateRuleUseCase)
        private readonly updateRule: UpdateRuleUseCase,
        @Inject(PromoteRuleToGlobalUseCase)
        private readonly promoteRule: PromoteRuleToGlobalUseCase,
        @Inject(BackfillRuleEvaluationUseCase)
        private readonly backfill: BackfillRuleEvaluationUseCase,
        @Inject(RULE_REPOSITORY_TOKEN)
        private readonly ruleRepo: IRuleRepository,
    ) {}

    // creates a new verification rule from the UI
    @Post()
    @HttpCode(HttpStatus.OK)
    async create(
        @Body(new ZodValidationPipe(createRuleBodySchema)) body: CreateRuleBody,
    ) {
        try {
            const rule = await this.createRule.execute({
                name: body.name,
                ...(body.trigger ? { trigger: body.trigger } : {}),
                ...(body.triggerOn !== undefined ? { triggerOn: body.triggerOn } : {}),
                expect: buildRuleExpect(body.expect),
                scope: body.scope,
                ...(body.taskId !== undefined ? { taskId: body.taskId } : {}),
                ...(body.severity !== undefined ? { severity: body.severity } : {}),
            });
            return { rule };
        } catch (err) {
            if (err instanceof InvalidRuleInputError) {
                throw new BadRequestException(
                    createApiErrorEnvelope("validation_error", err.message),
                );
            }
            throw err;
        }
    }

    // edits an existing rule from the UI
    @Patch(":id")
    @HttpCode(HttpStatus.OK)
    async update(
        @Param("id", pathParamPipe) id: string,
        @Body(new ZodValidationPipe(updateRuleBodySchema)) body: UpdateRuleBody,
    ) {
        try {
            const expectPatch = body.expect !== undefined
                ? {
                    ...(body.expect.tool !== undefined ? { tool: body.expect.tool } : {}),
                    ...(body.expect.commandMatches !== undefined
                        ? { commandMatches: body.expect.commandMatches }
                        : {}),
                    ...(body.expect.pattern !== undefined ? { pattern: body.expect.pattern } : {}),
                }
                : undefined;
            const rule = await this.updateRule.execute({
                id,
                ...(body.name !== undefined ? { name: body.name } : {}),
                ...(body.trigger !== undefined ? { trigger: body.trigger } : {}),
                ...(body.triggerOn !== undefined ? { triggerOn: body.triggerOn } : {}),
                ...(expectPatch !== undefined ? { expect: expectPatch } : {}),
                ...(body.severity !== undefined ? { severity: body.severity } : {}),
            });
            return { rule };
        } catch (err) {
            if (err instanceof RuleNotFoundError) {
                throw new NotFoundException(
                    createApiErrorEnvelope("RULE_NOT_FOUND", err.message),
                );
            }
            if (err instanceof InvalidRuleUpdateError) {
                throw new BadRequestException(
                    createApiErrorEnvelope("validation_error", err.message),
                );
            }
            throw err;
        }
    }

    // removes a rule from the UI
    @Delete(":id")
    async delete(@Param("id", pathParamPipe) id: string) {
        const deleted = await this.deleteRule.execute(id);
        if (!deleted) {
            throw new NotFoundException(
                createApiErrorEnvelope("RULE_NOT_FOUND", `Rule ${id} not found`),
            );
        }
        return { deleted: true };
    }

    // backfills rule evaluation against existing turns from the UI
    @Post(":id/re/evaluate")
    @HttpCode(HttpStatus.OK)
    async reEvaluate(@Param("id", pathParamPipe) id: string) {
        const rule = await this.ruleRepo.findById(id);
        if (!rule) {
            throw new NotFoundException(
                createApiErrorEnvelope("RULE_NOT_FOUND", `Rule ${id} not found`),
            );
        }
        const result = await this.backfill.execute(rule);
        return result;
    }

    // promotes a task-scoped rule to global scope from the UI
    @Post(":id/promote")
    @HttpCode(HttpStatus.OK)
    async promote(
        @Param("id", pathParamPipe) id: string,
        @Body(new ZodValidationPipe(promoteRuleBodySchema)) body: PromoteRuleBody,
    ) {
        try {
            const rule = await this.promoteRule.execute({
                id,
                edits: {
                    name: body.name,
                    ...(body.trigger ? { trigger: body.trigger } : {}),
                    expect: buildRuleExpect(body.expect),
                    severity: body.severity,
                    ...(body.rationale !== undefined ? { rationale: body.rationale } : {}),
                },
            });
            return { rule };
        } catch (err) {
            if (err instanceof RuleNotFoundError) {
                throw new NotFoundException(
                    createApiErrorEnvelope("RULE_NOT_FOUND", err.message),
                );
            }
            if (err instanceof InvalidRuleInputError) {
                throw new BadRequestException(
                    createApiErrorEnvelope("validation_error", err.message),
                );
            }
            throw err;
        }
    }
}
