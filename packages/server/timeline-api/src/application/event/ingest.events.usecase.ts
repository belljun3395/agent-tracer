import { Injectable } from "@nestjs/common";
import { EventRecordingService } from "@monitor/timeline-api/service/event/event.recording.service.js";
import type { IngestEventsUseCaseIn, IngestEventsUseCaseOut } from "@monitor/timeline-api/application/event/dto/ingest.events.usecase.dto.js";

@Injectable()
export class IngestEventsUseCase {
    constructor(private readonly eventRecording: EventRecordingService) {}

    async execute(input: IngestEventsUseCaseIn): Promise<IngestEventsUseCaseOut> {
        const accepted: IngestEventsUseCaseOut["accepted"][number][] = [];
        const rejected: IngestEventsUseCaseOut["rejected"][number][] = [];

        for (let i = 0; i < input.events.length; i++) {
            const event = input.events[i]!;
            try {
                // 각 이벤트는 독립 트랜잭션으로 기록해 한 건 실패가 배치 전체를 롤백하지 않게 한다.
                const result = await this.eventRecording.record(event);
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
