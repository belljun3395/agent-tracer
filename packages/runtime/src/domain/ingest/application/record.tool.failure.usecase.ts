import {toIngestEvents} from "~runtime/domain/ingest/model/event.envelope.model.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";
import type {ShapedToolEvent, ToolFailure, ToolShapeContext} from "~runtime/domain/ingest/model/tool.call.model.js";
import {shapeToolFailure} from "~runtime/domain/ingest/model/tool.failure.model.js";
import type {ClockPort} from "~runtime/domain/ingest/port/clock.port.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
import type {ToolTimingPort} from "~runtime/domain/ingest/port/tool.timing.port.js";
import {toRuntimeEvent} from "~runtime/domain/ingest/model/shaped.event.model.js";

/** 실패한 도구 호출을 성공 호출과 같은 어휘의 이벤트로 남긴다. */
export class RecordToolFailureUsecase {
    constructor(
        private readonly sink: EventSinkPort,
        private readonly timing: ToolTimingPort,
        private readonly ids: IdGeneratorPort,
        private readonly clock: ClockPort,
        private readonly runtimeSource: string,
        private readonly context: ToolShapeContext,
    ) {}

    async execute(failure: ToolFailure, target: IngestTarget): Promise<void> {
        const shaped = shapeToolFailure(failure, this.context);
        if (shaped === null) return;
        const timed = this.withDuration(shaped, failure, target);
        await this.sink.append(toIngestEvents(
            [toRuntimeEvent(timed, target)],
            this.runtimeSource,
            () => this.ids.next(),
            new Date(this.clock.now()).toISOString(),
        ));
    }

    /** PreToolUse가 남긴 시작 시각을 소거하며 읽어 소요 시간을 계산하고, 유한한 음이 아닌 값일 때만 싣는다. */
    private withDuration(shaped: ShapedToolEvent, failure: ToolFailure, target: IngestTarget): ShapedToolEvent {
        if (!failure.toolUseId) return shaped;
        const startedAt = this.timing.takeStart(target.sessionId, failure.toolUseId);
        if (startedAt === undefined) return shaped;
        const durationMs = this.clock.now() - startedAt;
        if (!Number.isFinite(durationMs) || durationMs < 0) return shaped;
        return {...shaped, metadata: {...shaped.metadata, durationMs}};
    }
}
