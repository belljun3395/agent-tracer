import { Controller, Post, Body, HttpException, HttpStatus, HttpCode, Inject } from "@nestjs/common";
import { ResolveRuntimeBindingUseCase } from "~application/sessions/index.js";
import { LogTokenUsageUseCase } from "~application/events/index.js";
import { otlpLogsRequestSchema } from "../schemas/otlp.logs.schema.js";
import { extractApiRequestRecords } from "~adapters/http/otlp/index.js";

@Controller("v1")
export class OtlpLogsController {
    constructor(
        @Inject(ResolveRuntimeBindingUseCase) private readonly resolveRuntimeBinding: ResolveRuntimeBindingUseCase,
        @Inject(LogTokenUsageUseCase) private readonly logTokenUsage: LogTokenUsageUseCase,
    ) {}

    @Post("logs")
    @HttpCode(HttpStatus.OK)
    async receiveLogs(@Body() body: unknown) {
        const parsed = otlpLogsRequestSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                {
                    ok: false,
                    error: {
                        code: "validation_error",
                        message: "Invalid OTLP logs request",
                        details: parsed.error.format(),
                    },
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        const records = extractApiRequestRecords(parsed.data);
        let accepted = 0;
        let skipped = 0;

        for (const record of records) {
            const binding = await this.resolveRuntimeBinding.execute({
                runtimeSource: record.runtimeSource,
                runtimeSessionId: record.sessionId,
            });
            if (!binding) {
                skipped++;
                continue;
            }
            await this.logTokenUsage.execute({
                taskId: binding.taskId,
                sessionId: binding.sessionId,
                ...(record.apiCalledAt ? { apiCalledAt: record.apiCalledAt } : {}),
                inputTokens: record.inputTokens,
                outputTokens: record.outputTokens,
                cacheReadTokens: record.cacheReadTokens,
                cacheCreateTokens: record.cacheCreateTokens,
                ...(record.costUsd != null ? { costUsd: record.costUsd } : {}),
                ...(record.durationMs != null ? { durationMs: record.durationMs } : {}),
                ...(record.model ? { model: record.model } : {}),
                ...(record.promptId ? { promptId: record.promptId } : {}),
            });
            accepted++;
        }

        return { ok: true, data: { accepted, skipped, total: records.length } };
    }
}
