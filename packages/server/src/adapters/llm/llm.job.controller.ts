import { Body, Controller, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import { LlmJobBroker } from "./llm.job.broker.js";

const resultBodySchema = z
    .object({
        ok: z.boolean(),
        output: z.unknown().optional(),
        error: z.string().optional(),
    })
    .strict();

type ResultBody = z.infer<typeof resultBodySchema>;

/**
 * Runtime-facing pull surface for LLM agent jobs. The local runtime daemon
 * claims a job, runs the Claude Agent SDK against the workspace, and posts the
 * result back here. Active only when MONITOR_LLM_RUNNER=remote — otherwise the
 * broker stays empty because the in-process runner handles execution.
 */
@Controller("ingest/v1/llm-jobs")
export class LlmJobController {
    constructor(private readonly broker: LlmJobBroker) {}

    @Post("claim")
    @HttpCode(HttpStatus.OK)
    claim(): { job: ReturnType<LlmJobBroker["claimNext"]> } {
        return { job: this.broker.claimNext() };
    }

    @Post(":id/result")
    @HttpCode(HttpStatus.OK)
    submit(
        @Param("id") id: string,
        @Body(new ZodValidationPipe(resultBodySchema)) body: ResultBody,
    ): { delivered: boolean } {
        const delivered = body.ok
            ? this.broker.resolve(id, body.output)
            : this.broker.reject(id, body.error ?? "Remote LLM job failed without a message.");
        return { delivered };
    }
}
