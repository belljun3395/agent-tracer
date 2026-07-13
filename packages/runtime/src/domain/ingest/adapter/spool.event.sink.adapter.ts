import {appendSpoolLines} from "~runtime/config/spool.js";
import type {IngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";

/** 이벤트를 로컬 스풀 세그먼트에 적어 데몬이 나중에 보낼 수 있게 한다. */
export class SpoolEventSinkAdapter implements EventSinkPort {
    append(events: readonly IngestEvent[]): Promise<void> {
        if (events.length > 0) appendSpoolLines(events.map((event) => JSON.stringify(event)));
        return Promise.resolve();
    }
}
