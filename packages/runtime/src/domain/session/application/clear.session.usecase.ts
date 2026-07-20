import {
    bindingKey,
    capBindingStore,
    mostRecentBindingWhere,
    type BindingRecord,
} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";
import {toRunIngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {EventSinkPort} from "~runtime/domain/ingest/port/event.sink.port.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
import {restored, type EnsuredSession} from "~runtime/domain/session/model/ensured.session.model.js";
import type {ClockPort} from "~runtime/domain/session/port/clock.port.js";
import {
    isSubagentSession,
    sessionEndedEvent,
    sessionStartedEvent,
    type SessionBindingInput,
} from "~runtime/domain/session/model/session.event.model.js";

/** /clear는 트랜스크립트와 무관하게 항상 독립된 새 태스크를 열고, 같은 워크스페이스에서 가장 최근에 활동한 비-서브에이전트 태스크를 닫는다. */
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
        let predecessor: BindingRecord | undefined;
        try {
            const store = this.bindings.read();
            predecessor = input.runtimePid === undefined
                ? undefined
                : mostRecentBindingWhere(store, (candidate) => (
                    candidate.runtimePid === input.runtimePid &&
                    candidate.supersededBy === undefined &&
                    bindingKey(candidate.runtimeSource, candidate.runtimeSessionId) !== key &&
                    !isSubagentSession(candidate.runtimeSessionId)
                ));
            created = {
                taskId: this.ids.next(),
                sessionId: this.ids.next(),
                runtimeSource: input.runtimeSource,
                runtimeSessionId: input.runtimeSessionId,
                ...(input.workspacePath ? {workspacePath: input.workspacePath} : {}),
                ...(input.runtimePid !== undefined ? {runtimePid: input.runtimePid} : {}),
                createdAt: new Date(this.clock.now()).toISOString(),
                titled: input.titled ?? true,
            };
            store[key] = created;
            if (predecessor) {
                store[bindingKey(predecessor.runtimeSource, predecessor.runtimeSessionId)] = {
                    ...predecessor,
                    supersededBy: input.runtimeSessionId,
                };
            }
            this.bindings.write(capBindingStore(store));
        } finally {
            this.bindings.releaseLock();
        }

        if (predecessor) {
            await this.append(sessionEndedEvent({
                taskId: predecessor.taskId,
                sessionId: predecessor.sessionId,
                runtimeSource: input.runtimeSource,
                runtimeSessionId: predecessor.runtimeSessionId,
                summary: "Claude Code conversation cleared (/clear)",
                completionReason: "cleared",
                completeTask: true,
            }));
        }

        await this.append(sessionStartedEvent(created.taskId, created.sessionId, {
            runtimeSource: input.runtimeSource,
            runtimeSessionId: input.runtimeSessionId,
            title: input.title,
            ...(input.workspacePath ? {workspacePath: input.workspacePath} : {}),
        }));
        return {taskId: created.taskId, sessionId: created.sessionId, taskCreated: true, firstTitling: false};
    }

    private async append(event: Parameters<typeof toRunIngestEvent>[0]): Promise<void> {
        await this.sink.append([toRunIngestEvent(
            event,
            new Date(this.clock.now()).toISOString(),
            () => this.ids.next(),
        )]);
    }
}
