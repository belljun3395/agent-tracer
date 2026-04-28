import { Injectable } from "@nestjs/common";
import { LogEventUseCase } from "./log.event.usecase.js";
import type { IngestEventsUseCaseIn, IngestEventsUseCaseOut } from "./dto/ingest.events.usecase.dto.js";

@Injectable()
export class IngestEventsUseCase {
    constructor(private readonly logEvent: LogEventUseCase) {}

    async execute(input: IngestEventsUseCaseIn): Promise<IngestEventsUseCaseOut> {
        const accepted: IngestEventsUseCaseOut["accepted"][number][] = [];
        const rejected: IngestEventsUseCaseOut["rejected"][number][] = [];

        for (let i = 0; i < input.events.length; i++) {
            const event = input.events[i]!;
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
