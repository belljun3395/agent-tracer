import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ListRulesUseCase } from "../application/list.rules.usecase.js";
import {
    rulesListQuerySchema,
    RulesListQueryDto,
} from "./rule.query.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/rules")
export class RuleQueryController {
    constructor(@Inject(ListRulesUseCase) private readonly listRules: ListRulesUseCase) {}

    @Get()
    async list(@Query(new ZodValidationPipe(rulesListQuerySchema)) query: RulesListQueryDto) {
        return this.listRules.execute({
            ...(query.scope ? { scope: query.scope } : {}),
            ...(query.taskId ? { taskId: query.taskId } : {}),
            ...(query.source ? { source: query.source } : {}),
        });
    }
}
