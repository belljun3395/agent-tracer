import {toIngestEvents} from "~runtime/domain/ingest/model/event.envelope.model.js";
import type {RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";
import {toRunIngestEvent, type RunEventInput} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";

/** 훅이 만든 이벤트를 태그와 출처 속성을 붙여 스풀에 넣는다. */
export class AppendEventsUsecase {
    constructor(
        private readonly sink: EventSinkPort,
        private readonly ids: IdGeneratorPort,
        private readonly runtimeSource: string,
    ) {}

    async execute(events: readonly (RuntimeIngestEvent | RunEventInput)[]): Promise<void> {
        if (events.length === 0) return;
        const occurredAt = new Date().toISOString();
        const nextId = (): string => this.ids.next();
        const runtime = events.filter(isRuntimeEvent);
        const raw = events.filter((event): event is RunEventInput => !isRuntimeEvent(event));
        await this.sink.append([
            ...toIngestEvents(runtime, this.runtimeSource, nextId, occurredAt),
            ...raw.map((event) => toRunIngestEvent(event, occurredAt, nextId)),
        ]);
    }
}

function isRuntimeEvent(event: RuntimeIngestEvent | RunEventInput): event is RuntimeIngestEvent {
    return "lane" in event;
}
