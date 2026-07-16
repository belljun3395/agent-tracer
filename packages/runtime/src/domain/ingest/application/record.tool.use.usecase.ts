import {toIngestEvents} from "~runtime/domain/ingest/model/event.envelope.model.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";
import {toRuntimeEvent} from "~runtime/domain/ingest/model/shaped.event.model.js";
import type {
    ShapedToolEvent,
    ToolCall,
    ToolShapeContext,
} from "~runtime/domain/ingest/model/tool.call.model.js";
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
        const timed = this.withDuration(shaped, call, target);
        await this.sink.append(toIngestEvents(
            [toRuntimeEvent(timed, target)],
            this.runtimeSource,
            () => this.ids.next(),
            new Date(this.clock.now()).toISOString(),
        ));
        return timed;
    }

    /** PreToolUse가 남긴 시작 시각을 소거하며 읽어 소요 시간을 계산하고, 유한한 음이 아닌 값일 때만 싣는다. */
    private withDuration(shaped: ShapedToolEvent, call: ToolCall, target: IngestTarget): ShapedToolEvent {
        if (!call.toolUseId) return shaped;
        const startedAt = this.timing.takeStart(target.sessionId, call.toolUseId);
        if (startedAt === undefined) return shaped;
        const durationMs = this.clock.now() - startedAt;
        if (!Number.isFinite(durationMs) || durationMs < 0) return shaped;
        return {...shaped, metadata: {...shaped.metadata, durationMs}};
    }
}
