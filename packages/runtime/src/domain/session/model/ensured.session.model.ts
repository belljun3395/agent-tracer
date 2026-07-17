import {turnStateOf, type BindingRecord} from "~runtime/domain/binding/model/binding.model.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";

/** 바인딩을 복원했는지 새로 만들었는지, `firstTitling`은 임시 제목이 이 호출에서 처음 진짜 제목으로 바뀐 첫 발화인지 알려주는 세션 확보 결과다. */
export interface EnsuredSession extends IngestTarget {
    readonly taskCreated: boolean;
    readonly firstTitling: boolean;
}

/** 이미 있던 바인딩을 그대로 세션 확보 결과로 투영한다. */
export function restored(binding: BindingRecord, firstTitling = false): EnsuredSession {
    const turn = turnStateOf(binding);
    return {
        taskId: binding.taskId,
        sessionId: binding.sessionId,
        taskCreated: false,
        firstTitling,
        ...(turn ? {turnId: turn.turnId} : {}),
    };
}
