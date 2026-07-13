import type {IngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import {isRecord} from "~runtime/support/json.js";

/** 관찰한 이벤트 하나를 자동화 하나에 넘기는 트리거다. */
export type EventAutomationTrigger = (event: ObservedEvent) => Promise<void>;

/** 자동화가 판단에 쓰는 이벤트의 최소 사실이다. */
export interface ObservedEvent {
    readonly kind: string;
    readonly taskId: string;
    readonly eventId: string;
    readonly prompt: string;
}

/** 스풀에서 관찰한 이벤트를 규칙 생성과 레시피 스캔 자동화에 넘긴다. */
export class EventAutomationDispatcher {
    constructor(private readonly triggers: readonly EventAutomationTrigger[]) {}

    dispatch(event: IngestEvent): void {
        const payload = isRecord(event.payload) ? event.payload : {};
        const observed: ObservedEvent = {
            kind: event.kind,
            taskId: event.taskId,
            eventId: event.id,
            prompt: typeof payload["body"] === "string" ? payload["body"] : "",
        };
        for (const trigger of this.triggers) void trigger(observed);
    }
}
