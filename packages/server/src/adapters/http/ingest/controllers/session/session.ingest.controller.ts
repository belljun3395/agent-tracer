import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import {
    EnsureRuntimeSessionUseCase,
    EndRuntimeSessionUseCase,
    type EnsureRuntimeSessionUseCaseIn,
    type EndRuntimeSessionUseCaseIn,
} from "~application/sessions/index.js";
import {
    runtimeSessionEndSchema,
    runtimeSessionEnsureSchema,
} from "~adapters/http/ingest/schemas/task.write.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("ingest/v1/sessions")
export class SessionIngestController {
    constructor(
        @Inject(EnsureRuntimeSessionUseCase) private readonly ensureRuntimeSession: EnsureRuntimeSessionUseCase,
        @Inject(EndRuntimeSessionUseCase) private readonly endRuntimeSession: EndRuntimeSessionUseCase,
    ) {}

    // idempotent session bootstrap called by hooks and MCP session tool
    @Post("ensure")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnsure(
        @Body(new ZodValidationPipe(runtimeSessionEnsureSchema))
        body: EnsureRuntimeSessionUseCaseIn,
    ) {
        return this.ensureRuntimeSession.execute(body);
    }

    // closes a session on Stop/SessionEnd hooks
    @Post("end")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnd(
        @Body(new ZodValidationPipe(runtimeSessionEndSchema))
        body: EndRuntimeSessionUseCaseIn,
    ) {
        await this.endRuntimeSession.execute({
            ...body,
            runtimeSource: body.runtimeSource.trim(),
            ...(body.backgroundCompletions
                ? { backgroundCompletions: body.backgroundCompletions.map((id) => id) }
                : {}),
        });
        return { ended: true };
    }
}
