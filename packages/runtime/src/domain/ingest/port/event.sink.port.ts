import type {IngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";

/** 원장으로 갈 이벤트를 내구성 있게 받아 두는 곳이다. */
export interface EventSinkPort {
    append(events: readonly IngestEvent[]): Promise<void>;
}
