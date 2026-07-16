import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import {toRunIngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
import type {ClockPort} from "~runtime/domain/session/port/clock.port.js";
import {taskLinkedEvent} from "~runtime/domain/session/model/session.event.model.js";

/** 에이전트가 스스로 판단한 더 나은 제목을 원장의 taskLinked 이벤트로 낸다. */
export class SetTaskTitleUsecase {
    constructor(
        private readonly sink: EventSinkPort,
        private readonly ids: IdGeneratorPort,
        private readonly clock: ClockPort,
    ) {}

    async execute(taskId: string, title: string): Promise<boolean> {
        const trimmed = title.trim();
        if (taskId === "" || trimmed === "") return false;
        await this.sink.append([toRunIngestEvent(
            taskLinkedEvent(taskId, trimmed),
            new Date(this.clock.now()).toISOString(),
            () => this.ids.next(),
        )]);
        return true;
    }
}
