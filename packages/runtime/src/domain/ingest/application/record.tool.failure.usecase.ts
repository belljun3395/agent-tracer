import {toIngestEvents} from "~runtime/domain/ingest/model/event.envelope.model.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";
import type {ToolFailure, ToolShapeContext} from "~runtime/domain/ingest/model/tool.call.model.js";
import {shapeToolFailure} from "~runtime/domain/ingest/model/tool.failure.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
import {toRuntimeEvent} from "~runtime/domain/ingest/model/shaped.event.model.js";

/** 실패한 도구 호출을 성공 호출과 같은 어휘의 이벤트로 남긴다. */
export class RecordToolFailureUsecase {
    constructor(
        private readonly sink: EventSinkPort,
        private readonly ids: IdGeneratorPort,
        private readonly runtimeSource: string,
        private readonly context: ToolShapeContext,
    ) {}

    async execute(failure: ToolFailure, target: IngestTarget): Promise<void> {
        const shaped = shapeToolFailure(failure, this.context);
        if (shaped === null) return;
        await this.sink.append(toIngestEvents(
            [toRuntimeEvent(shaped, target)],
            this.runtimeSource,
            () => this.ids.next(),
        ));
    }
}
