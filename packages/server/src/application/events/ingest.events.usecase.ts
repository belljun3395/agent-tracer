import { isTokenUsageEvent } from "~domain/index.js";
import { readTokenUsageMetadata } from "~domain/monitoring/event.metadata.js";
import { KIND } from "~domain/monitoring/event.kind.js";
import type { IngestEventInput, IngestResult } from "./ingest.events.usecase.dto.js";
import type { LogEventUseCase } from "./log.event.usecase.js";
import type { LogTokenUsageUseCase } from "./log.token.usage.usecase.js";

export class IngestEventsUseCase {
    constructor(
        private readonly logEvent: LogEventUseCase,
        private readonly logTokenUsage: LogTokenUsageUseCase,
    ) {}

    async execute(events: readonly IngestEventInput[]): Promise<IngestResult> {
        const accepted: IngestResult["accepted"][number][] = [];
        const rejected: IngestResult["rejected"][number][] = [];

        for (let i = 0; i < events.length; i++) {
            const event = events[i]!;
            try {
                if (isTokenUsageEvent(event)) {
                    const metadata = readTokenUsageMetadata(event.metadata);
                    await this.logTokenUsage.execute({
                        taskId: event.taskId,
                        ...(event.sessionId ? { sessionId: event.sessionId } : {}),
                        inputTokens: metadata.inputTokens,
                        outputTokens: metadata.outputTokens,
                        cacheReadTokens: metadata.cacheReadTokens ?? 0,
                        cacheCreateTokens: metadata.cacheCreateTokens ?? 0,
                        ...(metadata.costUsd != null ? { costUsd: metadata.costUsd } : {}),
                        ...(metadata.durationMs != null ? { durationMs: metadata.durationMs } : {}),
                        ...(metadata.model ? { model: metadata.model } : {}),
                        ...(metadata.promptId ? { promptId: metadata.promptId } : {}),
                    });
                    accepted.push({ eventId: KIND.tokenUsage, kind: KIND.tokenUsage, taskId: event.taskId });
                } else {
                    const result = await this.logEvent.execute(event);
                    for (const ev of result.events) {
                        accepted.push({ eventId: ev.id, kind: ev.kind, taskId: event.taskId });
                    }
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                const code = message.includes("not found") ? "task_not_found" : "ingestion_error";
                rejected.push({ index: i, code, message });
            }
        }

        return { accepted, rejected };
    }
}
