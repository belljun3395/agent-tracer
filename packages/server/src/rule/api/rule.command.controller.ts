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
import { InvalidRuleError, RuleNotFoundError } from "../common/errors.js";
import { CreateRuleUseCase } from "../application/create.rule.usecase.js";
import { DeleteRuleUseCase } from "../application/delete.rule.usecase.js";
import { PromoteRuleToGlobalUseCase } from "../application/promote.rule.to.global.usecase.js";
import { ReEvaluateRuleUseCase } from "../application/re-evaluate.rule.usecase.js";
import { UpdateRuleUseCase } from "../application/update.rule.usecase.js";
import {
    ruleCreateSchema,
    ruleUpdateSchema,
    type RuleCreateBody,
    type RuleUpdateBody,
} from "./rule.command.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/rules")
export class RuleCommandController {
    constructor(
        @Inject(CreateRuleUseCase) private readonly createRule: CreateRuleUseCase,
        @Inject(UpdateRuleUseCase) private readonly updateRule: UpdateRuleUseCase,
        @Inject(DeleteRuleUseCase) private readonly deleteRule: DeleteRuleUseCase,
        @Inject(PromoteRuleToGlobalUseCase) private readonly promoteRule: PromoteRuleToGlobalUseCase,
        @Inject(ReEvaluateRuleUseCase) private readonly reEvaluateRule: ReEvaluateRuleUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Body(new ZodValidationPipe(ruleCreateSchema)) body: RuleCreateBody) {
        try {
            return await this.createRule.execute({
                name: body.name,
                ...(body.trigger ? { trigger: body.trigger } : {}),
                ...(body.triggerOn ? { triggerOn: body.triggerOn } : {}),
                expect: {
                    ...(body.expect.tool !== undefined ? { action: body.expect.tool } : {}),
                    ...(body.expect.commandMatches !== undefined
                        ? { commandMatches: body.expect.commandMatches }
                        : {}),
                    ...(body.expect.pattern !== undefined ? { pattern: body.expect.pattern } : {}),
                },
                scope: body.scope,
                ...(body.taskId ? { taskId: body.taskId } : {}),
                ...(body.severity ? { severity: body.severity } : {}),
                ...(body.rationale ? { rationale: body.rationale } : {}),
            });
        } catch (err) {
            if (err instanceof InvalidRuleError) throw new BadRequestException(err.message);
            throw err;
        }
    }

    @Patch(":id")
    async update(
        @Param("id", pathParamPipe) id: string,
        @Body(new ZodValidationPipe(ruleUpdateSchema)) body: RuleUpdateBody,
    ) {
        try {
            const expectPatch = body.expect
                ? {
                    ...(body.expect.tool !== undefined ? { action: body.expect.tool } : {}),
                    ...(body.expect.commandMatches !== undefined
                        ? { commandMatches: body.expect.commandMatches }
                        : {}),
                    ...(body.expect.pattern !== undefined ? { pattern: body.expect.pattern } : {}),
                }
                : undefined;
            return await this.updateRule.execute({
                id,
                ...(body.name !== undefined ? { name: body.name } : {}),
                ...(body.trigger !== undefined ? { trigger: body.trigger } : {}),
                ...(body.triggerOn !== undefined ? { triggerOn: body.triggerOn } : {}),
                ...(expectPatch !== undefined ? { expect: expectPatch } : {}),
                ...(body.severity !== undefined ? { severity: body.severity } : {}),
                ...(body.rationale !== undefined ? { rationale: body.rationale } : {}),
            });
        } catch (err) {
            if (err instanceof RuleNotFoundError) throw new NotFoundException(err.message);
            if (err instanceof InvalidRuleError) throw new BadRequestException(err.message);
            throw err;
        }
    }

    @Delete(":id")
    @HttpCode(HttpStatus.OK)
    async delete(@Param("id", pathParamPipe) id: string) {
        try {
            await this.deleteRule.execute(id);
            return { deleted: true };
        } catch (err) {
            if (err instanceof RuleNotFoundError) throw new NotFoundException(err.message);
            throw err;
        }
    }

    @Post(":id/promote")
    @HttpCode(HttpStatus.OK)
    async promote(@Param("id", pathParamPipe) id: string) {
        try {
            return await this.promoteRule.execute({ ruleId: id });
        } catch (err) {
            if (err instanceof RuleNotFoundError) throw new NotFoundException(err.message);
            if (err instanceof InvalidRuleError) throw new BadRequestException(err.message);
            throw err;
        }
    }

    @Post(":id/re-evaluate")
    @HttpCode(HttpStatus.OK)
    async reEvaluate(@Param("id", pathParamPipe) id: string) {
        try {
            return await this.reEvaluateRule.execute({ ruleId: id });
        } catch (err) {
            if (err instanceof RuleNotFoundError) throw new NotFoundException(err.message);
            throw err;
        }
    }
}
