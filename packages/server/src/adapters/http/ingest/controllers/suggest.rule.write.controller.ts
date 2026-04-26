import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Inject,
    Post,
} from "@nestjs/common";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import {
    RegisterSuggestionUseCase,
    type RegisterSuggestionInput,
} from "~application/rules/index.js";
import { buildRuleExpect } from "~domain/verification/index.js";
import {
    suggestRuleBodySchema,
    type SuggestRuleBody,
} from "../schemas/suggest.rule.schema.js";

function toRegisterSuggestionInput(body: SuggestRuleBody): RegisterSuggestionInput {
    return {
        ...(body.trigger ? { trigger: { phrases: body.trigger.phrases } } : {}),
        ...(body.triggerOn !== undefined ? { triggerOn: body.triggerOn } : {}),
        expect: buildRuleExpect(body.expect),
        rationale: body.rationale,
        ...(body.severity !== undefined ? { severity: body.severity } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        taskId: body.taskId,
    };
}

@Controller("api/rules")
export class SuggestRuleWriteController {
    constructor(
        @Inject(RegisterSuggestionUseCase)
        private readonly registerSuggestion: RegisterSuggestionUseCase,
    ) {}

    @Post("suggestions")
    @HttpCode(HttpStatus.OK)
    async suggest(
        @Body(new ZodValidationPipe(suggestRuleBodySchema))
        body: SuggestRuleBody,
    ) {
        return this.registerSuggestion.execute(
            toRegisterSuggestionInput(body),
        );
    }
}
