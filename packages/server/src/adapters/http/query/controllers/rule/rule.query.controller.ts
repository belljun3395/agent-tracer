import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ListRulesUseCase } from "~application/rules/index.js";
import type { ListRulesFilter } from "~application/ports/repository/rule.repository.js";
import { z } from "zod";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

const listRulesQuerySchema = z.object({
    scope: z.enum(["global", "task"]).optional(),
    taskId: z.string().min(1).optional(),
    source: z.enum(["human", "agent"]).optional(),
});
type ListRulesQuery = z.infer<typeof listRulesQuerySchema>;

@Controller("api/v1/rules")
export class RulesQueryController {
    constructor(
        @Inject(ListRulesUseCase) private readonly listRules: ListRulesUseCase,
    ) {}

    // flat rule list; web groups by scope (global vs task) on the client side
    @Get()
    async list(
        @Query(new ZodValidationPipe(listRulesQuerySchema)) query: ListRulesQuery,
    ) {
        const filter: ListRulesFilter = {
            ...(query.scope !== undefined ? { scope: query.scope } : {}),
            ...(query.taskId !== undefined ? { taskId: query.taskId } : {}),
            ...(query.source !== undefined ? { source: query.source } : {}),
        };
        return this.listRules.execute(filter);
    }
}
