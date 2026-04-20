import { Body, Controller, Delete, HttpCode, HttpException, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import { CreateRuleCommandUseCase, DeleteRuleCommandUseCase } from "~application/rule-commands/index.js";
import { createRuleCommandSchema } from "../schemas/rule-command.write.schema.js";

@Controller()
export class RuleCommandWriteController {
    constructor(
        @Inject(CreateRuleCommandUseCase) private readonly createRuleCommand: CreateRuleCommandUseCase,
        @Inject(DeleteRuleCommandUseCase) private readonly deleteRuleCommand: DeleteRuleCommandUseCase,
    ) {}

    @Post("/api/rule-commands")
    @HttpCode(HttpStatus.OK)
    async createGlobal(@Body() body: unknown) {
        const parsed = createRuleCommandSchema.parse(body);
        const ruleCommand = await this.createRuleCommand.execute(parsed);
        return { ruleCommand };
    }

    @Delete("/api/rule-commands/:id")
    async deleteGlobal(@Param("id") id: string) {
        const deleted = await this.deleteRuleCommand.execute(id);
        if (!deleted) throw new HttpException({ ok: false, error: "Rule command not found" }, HttpStatus.NOT_FOUND);
        return { ok: true };
    }

    @Post("/api/tasks/:taskId/rule-commands")
    @HttpCode(HttpStatus.OK)
    async createForTask(@Param("taskId") taskId: string, @Body() body: unknown) {
        const parsed = createRuleCommandSchema.parse(body);
        const ruleCommand = await this.createRuleCommand.execute({ ...parsed, taskId });
        return { ruleCommand };
    }

    @Delete("/api/tasks/:taskId/rule-commands/:id")
    async deleteForTask(@Param("taskId") _taskId: string, @Param("id") id: string) {
        const deleted = await this.deleteRuleCommand.execute(id);
        if (!deleted) throw new HttpException({ ok: false, error: "Rule command not found" }, HttpStatus.NOT_FOUND);
        return { ok: true };
    }
}
