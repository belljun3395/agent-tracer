import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import type { EndRuntimeSessionUseCaseIn } from "~application/sessions/dto/end.runtime.session.usecase.dto.js";
import type { EnsureRuntimeSessionUseCaseIn } from "~application/sessions/dto/ensure.runtime.session.usecase.dto.js";
import { EndRuntimeSessionUseCase } from "~application/sessions/end.runtime.session.usecase.js";
import { EnsureRuntimeSessionUseCase } from "~application/sessions/ensure.runtime.session.usecase.js";
import {
    runtimeSessionEndSchema,
    runtimeSessionEnsureSchema,
} from "~adapters/http/ingest/schemas/session.ingest.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("ingest/v1/sessions")
export class SessionIngestController {
    constructor(
        @Inject(EnsureRuntimeSessionUseCase) private readonly ensureRuntimeSession: EnsureRuntimeSessionUseCase,
        @Inject(EndRuntimeSessionUseCase) private readonly endRuntimeSession: EndRuntimeSessionUseCase,
    ) {}

    @Post("ensure")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnsure(
        @Body(new ZodValidationPipe(runtimeSessionEnsureSchema))
        body: EnsureRuntimeSessionUseCaseIn,
    ) {
        return this.ensureRuntimeSession.execute(body);
    }

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
