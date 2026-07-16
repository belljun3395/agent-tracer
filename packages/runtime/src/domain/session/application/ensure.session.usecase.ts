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
    taskLinkedEvent,
    type SessionBindingInput,
} from "~runtime/domain/session/model/session.event.model.js";

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
        let resumedFromPrior: BindingRecord | undefined;
        try {
            const store = this.bindings.read();
            existing = store[key];
            if (!existing) {
                resumedFromPrior = input.resumedFrom
                    ? store[bindingKey(input.runtimeSource, input.resumedFrom)]
                    : undefined;
                created = {
                    taskId: resumedFromPrior?.taskId ?? (input.taskId?.trim() || this.ids.next()),
                    sessionId: this.ids.next(),
                    runtimeSource: input.runtimeSource,
                    runtimeSessionId: input.runtimeSessionId,
                    ...(input.workspacePath ? {workspacePath: input.workspacePath} : {}),
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

        await this.append(sessionStartedEvent(created.taskId, created.sessionId, {
            ...input,
            ...(resumedFromPrior
                ? {parentSessionId: resumedFromPrior.sessionId, resume: true}
                : {}),
        }));
        return {taskId: created.taskId, sessionId: created.sessionId, taskCreated: !resumedFromPrior};
    }

    private async append(event: Parameters<typeof toRunIngestEvent>[0]): Promise<void> {
        await this.sink.append([toRunIngestEvent(
            event,
            new Date(this.clock.now()).toISOString(),
            () => this.ids.next(),
        )]);
    }
}
