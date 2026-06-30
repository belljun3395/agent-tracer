import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    Post,
    Query,
} from "@nestjs/common";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { InvalidRuleError } from "../../domain/rule/errors.js";
import { ListRulesUseCase } from "../../application/rule/list.rules.usecase.js";
import { RegisterSuggestionUseCase } from "../../application/rule/register.suggestion.usecase.js";
import {
    ruleSuggestionIngestSchema,
    rulesListIngestQuerySchema,
    RuleSuggestionIngestDto,
    RulesListIngestQueryDto,
} from "./rule.ingest.schema.js";

@Controller("ingest/v1/rules")
export class RuleIngestController {
    constructor(
        @Inject(RegisterSuggestionUseCase)
        private readonly registerSuggestion: RegisterSuggestionUseCase,
        @Inject(ListRulesUseCase) private readonly listRules: ListRulesUseCase,
    ) {}

    @Post("suggestions")
    @HttpCode(HttpStatus.OK)
    async suggest(
        @Body(new ZodValidationPipe(ruleSuggestionIngestSchema))
        body: RuleSuggestionIngestDto,
    ) {
        try {
            return await this.registerSuggestion.execute({
                name: body.name,
                ...(body.trigger ? { trigger: body.trigger } : {}),
                ...(body.triggerOn ? { triggerOn: body.triggerOn } : {}),
                expect: {
                    ...(body.expect.action !== undefined
                        ? { action: body.expect.action }
                        : {}),
                    ...(body.expect.commandMatches !== undefined
                        ? { commandMatches: body.expect.commandMatches }
                        : {}),
                    ...(body.expect.pattern !== undefined
                        ? { pattern: body.expect.pattern }
                        : {}),
                },
                scope: body.scope,
                ...(body.taskId ? { taskId: body.taskId } : {}),
                ...(body.severity ? { severity: body.severity } : {}),
                ...(body.rationale ? { rationale: body.rationale } : {}),
            });
        } catch (err) {
            if (err instanceof InvalidRuleError) {
                throw new BadRequestException(err.message);
            }
            throw err;
        }
    }

    @Get()
    async list(
        @Query(new ZodValidationPipe(rulesListIngestQuerySchema))
        query: RulesListIngestQueryDto,
    ) {
        return this.listRules.execute({
            ...(query.scope ? { scope: query.scope } : {}),
            ...(query.taskId ? { taskId: query.taskId } : {}),
            ...(query.source ? { source: query.source } : {}),
        });
    }
}
