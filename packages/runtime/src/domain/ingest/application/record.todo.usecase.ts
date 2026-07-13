import {toIngestEvents} from "~runtime/domain/ingest/model/event.envelope.model.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";
import type {ToolCall} from "~runtime/domain/ingest/model/tool.call.model.js";
import {shapeTodoEvents} from "~runtime/domain/ingest/model/todo.tool.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import type {TodoSnapshotPort} from "~runtime/domain/ingest/port/todo.snapshot.port.js";
import {toRuntimeEvent} from "~runtime/domain/ingest/model/shaped.event.model.js";

/** 할 일 도구 호출을 직전 스냅샷과 대조해 전이 이벤트로 남긴다. */
export class RecordTodoUsecase {
    constructor(
        private readonly sink: EventSinkPort,
        private readonly snapshots: TodoSnapshotPort,
        private readonly runtimeSource: string,
    ) {}

    async execute(call: ToolCall, target: IngestTarget, runtimeSessionId: string): Promise<void> {
        const {events, snapshot} = shapeTodoEvents(call, this.snapshots.load(runtimeSessionId));
        if (events.length > 0) {
            await this.sink.append(toIngestEvents(
                events.map((shaped) => toRuntimeEvent(shaped, target)),
                this.runtimeSource,
            ));
        }
        if (snapshot !== null) this.snapshots.save(runtimeSessionId, snapshot);
    }
}
