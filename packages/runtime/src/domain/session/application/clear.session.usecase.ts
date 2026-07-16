import {
    bindingKey,
    capBindingStore,
    type BindingRecord,
} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";
import {toRunIngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
import {restored, type EnsuredSession} from "~runtime/domain/session/model/ensured.session.model.js";
import type {ClockPort} from "~runtime/domain/session/port/clock.port.js";
import {
    sessionStartedEvent,
    type SessionBindingInput,
} from "~runtime/domain/session/model/session.event.model.js";

/** /clear 뒤의 세션은 트랜스크립트와 무관하게 항상 독립된 새 태스크로 열고 직전 태스크는 SessionEnd(clear)가 닫는다. */
export class ClearSessionUsecase {
    constructor(
        private readonly bindings: BindingStorePort,
        private readonly sink: EventSinkPort,
        private readonly ids: IdGeneratorPort,
        private readonly clock: ClockPort,
    ) {}

    async execute(input: SessionBindingInput): Promise<EnsuredSession> {
        const key = bindingKey(input.runtimeSource, input.runtimeSessionId);

        if (!(await this.bindings.acquireLock())) {
            const contended = this.bindings.read()[key];
            if (contended) return restored(contended);
            throw new Error("bindings lock unavailable, cannot clear session binding");
        }

        let created: BindingRecord;
        try {
            const store = this.bindings.read();
            created = {
                taskId: this.ids.next(),
                sessionId: this.ids.next(),
                runtimeSource: input.runtimeSource,
                runtimeSessionId: input.runtimeSessionId,
                createdAt: new Date(this.clock.now()).toISOString(),
                titled: input.titled ?? true,
            };
            store[key] = created;
            this.bindings.write(capBindingStore(store));
        } finally {
            this.bindings.releaseLock();
        }

        await this.append(sessionStartedEvent(created.taskId, created.sessionId, {
            runtimeSource: input.runtimeSource,
            runtimeSessionId: input.runtimeSessionId,
            title: input.title,
            ...(input.workspacePath ? {workspacePath: input.workspacePath} : {}),
        }));
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
