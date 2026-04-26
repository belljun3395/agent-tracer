import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post, Query } from "@nestjs/common";
import {
    RecordBriefingCopyUseCase,
    SaveBriefingUseCase,
    type SaveBriefingUseCaseIn,
} from "~application/workflow/index.js";
import { briefingSaveSchema } from "~adapters/http/command/schemas/briefing.command.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/tasks/:id")
export class TaskBriefingCommandController {
    constructor(
        @Inject(RecordBriefingCopyUseCase) private readonly recordBriefingCopy: RecordBriefingCopyUseCase,
        @Inject(SaveBriefingUseCase) private readonly saveBriefing: SaveBriefingUseCase,
    ) {}

    @Post("briefing/copied")
    @HttpCode(HttpStatus.OK)
    async recordBriefingCopyEndpoint(
        @Param("id", pathParamPipe) taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
    ) {
        await this.recordBriefingCopy.execute({ taskId, scopeKey });
        return { recorded: true };
    }

    @Post("briefings")
    @HttpCode(HttpStatus.OK)
    async saveBriefingEndpoint(
        @Param("id", pathParamPipe) taskId: string,
        @Body(new ZodValidationPipe(briefingSaveSchema)) body: Omit<SaveBriefingUseCaseIn, "taskId">,
    ) {
        return this.saveBriefing.execute({
            taskId,
            purpose: body.purpose,
            format: body.format,
            content: body.content,
            generatedAt: body.generatedAt,
            ...(body.memo !== undefined ? { memo: body.memo } : {}),
        });
    }
}
