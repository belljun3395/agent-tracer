import { Controller, Post, Body, HttpException, HttpStatus, HttpCode } from "@nestjs/common";
import { TaskId, SessionId } from "@monitor/domain";
import { MonitorService } from "@monitor/application";
import { otlpLogsRequestSchema } from "./schemas.otlp.js";
import { extractApiRequestRecords } from "./otlp-mapper.js";

const RUNTIME_SOURCE = "claude-plugin";

@Controller("v1")
export class OtlpLogsController {
    constructor(private readonly monitor: MonitorService) {}

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
            const binding = await this.monitor.resolveRuntimeBinding(RUNTIME_SOURCE, record.sessionId);
            if (!binding) {
                skipped++;
                continue;
            }
            await this.monitor.logTokenUsage({
                taskId: TaskId(binding.taskId),
                sessionId: SessionId(binding.sessionId),
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
