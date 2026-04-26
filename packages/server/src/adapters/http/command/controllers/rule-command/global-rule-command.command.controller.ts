import { Body, Controller, Delete, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post } from "@nestjs/common";
import { CreateRuleCommandUseCase, DeleteRuleCommandUseCase } from "~application/rule-commands/index.js";
import type { CreateRuleCommandUseCaseIn } from "~application/rule-commands/index.js";
import { createRuleCommandSchema } from "~adapters/http/command/schemas/rule-command.command.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/rule-commands")
export class GlobalRuleCommandCommandController {
    constructor(
        @Inject(CreateRuleCommandUseCase) private readonly createRuleCommand: CreateRuleCommandUseCase,
        @Inject(DeleteRuleCommandUseCase) private readonly deleteRuleCommand: DeleteRuleCommandUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async createGlobal(
        @Body(new ZodValidationPipe(createRuleCommandSchema))
        body: CreateRuleCommandUseCaseIn,
    ) {
        const ruleCommand = await this.createRuleCommand.execute(body);
        return { ruleCommand };
    }

    @Delete(":id")
    async delete(@Param("id", pathParamPipe) id: string) {
        const result = await this.deleteRuleCommand.execute({ id });
        if (!result.deleted) throw new NotFoundException("Rule command not found");
        return { deleted: true };
    }
}
