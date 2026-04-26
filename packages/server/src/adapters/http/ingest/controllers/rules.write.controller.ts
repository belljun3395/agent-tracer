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
import { buildRuleExpect } from "~domain/verification/index.js";
import { createApiErrorEnvelope } from "~main/presentation/interceptors/api-response-envelope.js";
import {
    createRuleBodySchema,
    promoteRuleBodySchema,
    updateRuleBodySchema,
    type CreateRuleBody,
    type PromoteRuleBody,
    type UpdateRuleBody,
} from "../schemas/rules.write.schema.js";

@Controller("api/rules")
export class RulesWriteController {
    constructor(
        @Inject(CreateRuleUseCase)
        private readonly createRule: CreateRuleUseCase,
        @Inject(DeleteRuleUseCase)
        private readonly deleteRule: DeleteRuleUseCase,
        @Inject(UpdateRuleUseCase)
        private readonly updateRule: UpdateRuleUseCase,
        @Inject(PromoteRuleToGlobalUseCase)
        private readonly promoteRule: PromoteRuleToGlobalUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async create(
        @Body(new ZodValidationPipe(createRuleBodySchema)) body: CreateRuleBody,
    ) {
        try {
            const rule = await this.createRule.execute({
                name: body.name,
                ...(body.trigger ? { trigger: body.trigger } : {}),
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
