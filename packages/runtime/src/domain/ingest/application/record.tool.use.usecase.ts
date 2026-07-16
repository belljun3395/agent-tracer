import {toIngestEvents} from "~runtime/domain/ingest/model/event.envelope.model.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";
import {toRuntimeEvent} from "~runtime/domain/ingest/model/shaped.event.model.js";
import type {
    ShapedToolEvent,
    ToolCall,
    ToolShapeContext,
} from "~runtime/domain/ingest/model/tool.call.model.js";
import {withToolDuration} from "~runtime/domain/ingest/model/tool.duration.model.js";
import {shapeToolEvent} from "~runtime/domain/ingest/model/tool.shape.model.js";
import type {ClockPort} from "~runtime/domain/ingest/port/clock.port.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
import type {ToolTimingPort} from "~runtime/domain/ingest/port/tool.timing.port.js";

/** 도구 호출 하나를 도메인 조형 규칙으로 원장 이벤트로 만들어 스풀에 넣는다. */
export class RecordToolUseUsecase {
    constructor(
        private readonly sink: EventSinkPort,
        private readonly timing: ToolTimingPort,
        private readonly ids: IdGeneratorPort,
        private readonly clock: ClockPort,
        private readonly runtimeSource: string,
        private readonly context: ToolShapeContext,
    ) {}

    async execute(call: ToolCall, target: IngestTarget): Promise<ShapedToolEvent | null> {
        const shaped = shapeToolEvent(call, this.context);
        if (shaped === null) return null;
        const timed = withToolDuration(shaped, {
            ...(call.toolUseId ? {toolUseId: call.toolUseId} : {}),
            sessionId: target.sessionId,
            takeStart: (sessionId, toolUseId) => this.timing.takeStart(sessionId, toolUseId),
            now: this.clock.now(),
        });
        await this.sink.append(toIngestEvents(
            [toRuntimeEvent(timed, target)],
            this.runtimeSource,
            () => this.ids.next(),
            new Date(this.clock.now()).toISOString(),
        ));
        return timed;
    }
}
