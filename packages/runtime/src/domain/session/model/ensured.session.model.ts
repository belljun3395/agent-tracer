import {turnStateOf, type BindingRecord} from "~runtime/domain/binding/model/binding.model.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";

/** 바인딩을 복원했는지 새로 만들었는지까지 알려주는 세션 확보 결과다. */
export interface EnsuredSession extends IngestTarget {
    readonly taskCreated: boolean;
}

/** 이미 있던 바인딩을 그대로 세션 확보 결과로 투영한다. */
export function restored(binding: BindingRecord): EnsuredSession {
    const turn = turnStateOf(binding);
    return {
        taskId: binding.taskId,
        sessionId: binding.sessionId,
        taskCreated: false,
        ...(turn ? {turnId: turn.turnId} : {}),
    };
}
