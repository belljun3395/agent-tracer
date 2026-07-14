import {
    bindingKey,
    capBindingStore,
    turnStateOf,
    type BindingRecord,
} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";
import {toRunIngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
import type {ClockPort} from "~runtime/domain/session/port/clock.port.js";
import {
    sessionStartedEvent,
    taskLinkedEvent,
    type SessionBindingInput,
} from "~runtime/domain/session/model/session.event.model.js";

/** 바인딩을 복원했는지 새로 만들었는지까지 알려주는 세션 확보 결과다. */
export interface EnsuredSession extends IngestTarget {
    readonly taskCreated: boolean;
}

/** 런타임 세션을 기존 태스크에 복원하거나 새 태스크에 연결한다. */
export class EnsureSessionUsecase {
    constructor(
        private readonly bindings: BindingStorePort,
        private readonly sink: EventSinkPort,
        private readonly ids: IdGeneratorPort,
        private readonly clock: ClockPort,
    ) {}

    async execute(input: SessionBindingInput): Promise<EnsuredSession> {
        const key = bindingKey(input.runtimeSource, input.runtimeSessionId);
        const titled = input.titled ?? true;

        if (!(await this.bindings.acquireLock())) {
            const contended = this.bindings.read()[key];
            if (contended) return restored(contended);
            throw new Error("bindings lock unavailable, cannot create session binding");
        }

        let created: BindingRecord | undefined;
        let existing: BindingRecord | undefined;
        let retitled = false;
        try {
            const store = this.bindings.read();
            existing = store[key];
            if (!existing) {
                created = {
                    taskId: input.taskId?.trim() || this.ids.next(),
                    sessionId: this.ids.next(),
                    runtimeSource: input.runtimeSource,
                    runtimeSessionId: input.runtimeSessionId,
                    createdAt: new Date(this.clock.now()).toISOString(),
                    titled,
                };
                store[key] = created;
                this.bindings.write(capBindingStore(store));
            } else if (titled && existing.titled !== true) {
                existing = {...existing, titled: true};
                store[key] = existing;
                this.bindings.write(store);
                retitled = true;
            }
        } finally {
            this.bindings.releaseLock();
        }

        if (existing) {
            if (retitled) await this.append(taskLinkedEvent(existing.taskId, input.title));
            return restored(existing);
        }
        if (!created) throw new Error("session binding was not created");

        await this.append(sessionStartedEvent(created.taskId, created.sessionId, input));
        return {taskId: created.taskId, sessionId: created.sessionId, taskCreated: true};
    }

    private async append(event: Parameters<typeof toRunIngestEvent>[0]): Promise<void> {
        await this.sink.append([toRunIngestEvent(
            event,
            new Date(this.clock.now()).toISOString(),
            () => this.ids.next(),
        )]);
    }
}

function restored(binding: BindingRecord): EnsuredSession {
    const turn = turnStateOf(binding);
    return {
        taskId: binding.taskId,
        sessionId: binding.sessionId,
        taskCreated: false,
        ...(turn ? {turnId: turn.turnId} : {}),
    };
}
