import { Body, Controller, Delete, HttpCode, HttpException, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import { CreateRuleCommandUseCase, DeleteRuleCommandUseCase } from "~application/rule-commands/index.js";
import { createRuleCommandSchema } from "../schemas/rule-command.write.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/rule-commands")
export class GlobalRuleCommandWriteController {
    constructor(
        @Inject(CreateRuleCommandUseCase) private readonly createRuleCommand: CreateRuleCommandUseCase,
        @Inject(DeleteRuleCommandUseCase) private readonly deleteRuleCommand: DeleteRuleCommandUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async createGlobal(
        @Body(new ZodValidationPipe(createRuleCommandSchema))
        body: Parameters<CreateRuleCommandUseCase["execute"]>[0],
    ) {
        const ruleCommand = await this.createRuleCommand.execute(body);
        return { ruleCommand };
    }

    @Delete(":id")
    async deleteGlobal(@Param("id", pathParamPipe) id: string) {
        const deleted = await this.deleteRuleCommand.execute(id);
        if (!deleted) throw new HttpException({ ok: false, error: "Rule command not found" }, HttpStatus.NOT_FOUND);
        return { ok: true };
    }
}

@Controller("api/tasks/:taskId/rule-commands")
export class TaskRuleCommandWriteController {
    constructor(
        @Inject(CreateRuleCommandUseCase) private readonly createRuleCommand: CreateRuleCommandUseCase,
        @Inject(DeleteRuleCommandUseCase) private readonly deleteRuleCommand: DeleteRuleCommandUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async createForTask(
        @Param("taskId", pathParamPipe) taskId: string,
        @Body(new ZodValidationPipe(createRuleCommandSchema))
        body: Parameters<CreateRuleCommandUseCase["execute"]>[0],
    ) {
        const ruleCommand = await this.createRuleCommand.execute({ ...body, taskId });
        return { ruleCommand };
    }

    @Delete(":id")
    async deleteForTask(@Param("taskId", pathParamPipe) _taskId: string, @Param("id", pathParamPipe) id: string) {
        const deleted = await this.deleteRuleCommand.execute(id);
        if (!deleted) throw new HttpException({ ok: false, error: "Rule command not found" }, HttpStatus.NOT_FOUND);
        return { ok: true };
    }
}
