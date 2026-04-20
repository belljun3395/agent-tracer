import type { IngestEventInput, IngestResult } from "./ingest.events.usecase.dto.js";
import type { LogEventUseCase } from "./log.event.usecase.js";

export class IngestEventsUseCase {
    constructor(
        private readonly logEvent: LogEventUseCase,
    ) {}

    async execute(events: readonly IngestEventInput[]): Promise<IngestResult> {
        const accepted: IngestResult["accepted"][number][] = [];
        const rejected: IngestResult["rejected"][number][] = [];

        for (let i = 0; i < events.length; i++) {
            const event = events[i]!;
            try {
                const result = await this.logEvent.execute(event);
                for (const ev of result.events) {
                    accepted.push({ eventId: ev.id, kind: ev.kind, taskId: event.taskId });
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
