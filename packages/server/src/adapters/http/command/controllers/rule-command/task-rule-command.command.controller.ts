import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import { CreateRuleCommandUseCase } from "~application/rule-commands/index.js";
import type { CreateRuleCommandUseCaseIn } from "~application/rule-commands/index.js";
import { createRuleCommandSchema } from "~adapters/http/command/schemas/rule-command.command.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/tasks/:taskId/rule-commands")
export class TaskRuleCommandCommandController {
    constructor(@Inject(CreateRuleCommandUseCase) private readonly createRuleCommand: CreateRuleCommandUseCase) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async createForTask(
        @Param("taskId", pathParamPipe) taskId: string,
        @Body(new ZodValidationPipe(createRuleCommandSchema))
        body: Omit<CreateRuleCommandUseCaseIn, "taskId">,
    ) {
        const ruleCommand = await this.createRuleCommand.execute({ ...body, taskId });
        return { ruleCommand };
    }
}
