import type {ClearSessionUsecase} from "~runtime/domain/session/application/clear.session.usecase.js";
import type {EndSessionUsecase} from "~runtime/domain/session/application/end.session.usecase.js";
import type {EnsureSessionUsecase} from "~runtime/domain/session/application/ensure.session.usecase.js";
import type {EnsuredSession} from "~runtime/domain/session/model/ensured.session.model.js";
import type {SessionBindingInput, SessionEndInput} from "~runtime/domain/session/model/session.event.model.js";

/** 세션 도메인이 어댑터에 제공하는 진입점 묶음이다. */
export interface SessionHook {
    readonly ensureSession: EnsureSessionUsecase;
    readonly endSession: EndSessionUsecase;
    readonly clearSession: ClearSessionUsecase;
}

export function onSessionStart(hook: SessionHook, input: SessionBindingInput): Promise<EnsuredSession> {
    return hook.ensureSession.execute(input);
}

export function onSessionClear(hook: SessionHook, input: SessionBindingInput): Promise<EnsuredSession> {
    return hook.clearSession.execute(input);
}

export function onSessionEnd(hook: SessionHook, input: SessionEndInput): Promise<void> {
    return hook.endSession.execute(input);
}
