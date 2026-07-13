import {toRunIngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import {sessionEndedEvent, type SessionEndInput} from "~runtime/domain/session/model/session.event.model.js";

/** 세션 종료를 원장에 알리고 필요하면 태스크까지 완료로 넘긴다. */
export class EndSessionUsecase {
    constructor(private readonly sink: EventSinkPort) {}

    async execute(input: SessionEndInput): Promise<void> {
        await this.sink.append([toRunIngestEvent(sessionEndedEvent(input), new Date().toISOString())]);
    }
}
