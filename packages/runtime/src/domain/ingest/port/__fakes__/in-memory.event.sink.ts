import type {IngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";

export class InMemoryEventSink implements EventSinkPort {
    readonly events: IngestEvent[] = [];

    async append(events: readonly IngestEvent[]): Promise<void> {
        this.events.push(...events);
    }
}
