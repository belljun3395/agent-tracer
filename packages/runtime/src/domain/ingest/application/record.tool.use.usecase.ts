import {toIngestEvents} from "~runtime/domain/ingest/model/event.envelope.model.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";
import {toRuntimeEvent} from "~runtime/domain/ingest/model/shaped.event.model.js";
import type {
    ShapedToolEvent,
    ToolCall,
    ToolShapeContext,
} from "~runtime/domain/ingest/model/tool.call.model.js";
import {shapeToolEvent} from "~runtime/domain/ingest/model/tool.shape.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";

/** 도구 호출 하나를 도메인 조형 규칙으로 원장 이벤트로 만들어 스풀에 넣는다. */
export class RecordToolUseUsecase {
    constructor(
        private readonly sink: EventSinkPort,
        private readonly ids: IdGeneratorPort,
        private readonly runtimeSource: string,
        private readonly context: ToolShapeContext,
    ) {}

    async execute(call: ToolCall, target: IngestTarget): Promise<ShapedToolEvent | null> {
        const shaped = shapeToolEvent(call, this.context);
        if (shaped === null) return null;
        await this.sink.append(toIngestEvents(
            [toRuntimeEvent(shaped, target)],
            this.runtimeSource,
            () => this.ids.next(),
        ));
        return shaped;
    }
}
