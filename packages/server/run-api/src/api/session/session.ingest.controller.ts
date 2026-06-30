import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import type { EndRuntimeSessionIn } from "../../application/session/dto/end.runtime.session.dto.js";
import type { EnsureRuntimeSessionIn } from "../../application/session/dto/ensure.runtime.session.dto.js";
import { EndRuntimeSessionUseCase } from "../../application/session/end.runtime.session.usecase.js";
import { EnsureRuntimeSessionUseCase } from "../../application/session/ensure.runtime.session.usecase.js";
import {
    runtimeSessionEndSchema,
    runtimeSessionEnsureSchema,
} from "./session.ingest.schema.js";

@Controller("ingest/v1/sessions")
export class SessionIngestController {
    constructor(
        private readonly ensureRuntimeSession: EnsureRuntimeSessionUseCase,
        private readonly endRuntimeSession: EndRuntimeSessionUseCase,
    ) {}

    @Post("ensure")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnsure(
        @Body(new ZodValidationPipe(runtimeSessionEnsureSchema))
        body: EnsureRuntimeSessionIn,
    ) {
        return this.ensureRuntimeSession.execute(body);
    }

    @Post("end")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnd(
        @Body(new ZodValidationPipe(runtimeSessionEndSchema))
        body: EndRuntimeSessionIn,
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
