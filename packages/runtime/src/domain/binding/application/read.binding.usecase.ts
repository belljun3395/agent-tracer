import {bindingKey, turnStateOf, type TurnState} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";

/** 런타임 세션이 붙잡고 있는 태스크와 세션과 열린 턴이다. */
export interface BoundSession extends IngestTarget {
    readonly startedAt: string;
    readonly turn?: TurnState;
}

/** 이미 관측된 런타임 세션의 바인딩을 조회한다. */
export class ReadBindingUsecase {
    constructor(private readonly bindings: BindingStorePort) {}

    execute(runtimeSource: string, runtimeSessionId: string): BoundSession | undefined {
        const binding = this.bindings.read()[bindingKey(runtimeSource, runtimeSessionId)];
        if (!binding) return undefined;
        const turn = turnStateOf(binding);
        return {
            taskId: binding.taskId,
            sessionId: binding.sessionId,
            startedAt: binding.createdAt,
            ...(turn ? {turnId: turn.turnId, turn} : {}),
        };
    }
}
