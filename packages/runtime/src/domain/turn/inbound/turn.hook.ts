import type {CloseTurnInput, CloseTurnUsecase} from "~runtime/domain/turn/application/close.turn.usecase.js";
import type {OpenTurnInput, OpenTurnUsecase} from "~runtime/domain/turn/application/open.turn.usecase.js";

/** 턴 도메인이 어댑터에 제공하는 진입점 묶음이다. */
export interface TurnHook {
    readonly openTurn: OpenTurnUsecase;
    readonly closeTurn: CloseTurnUsecase;
}

export function onTurnOpen(hook: TurnHook, input: OpenTurnInput): Promise<void> {
    return hook.openTurn.execute(input);
}

export function onTurnClose(hook: TurnHook, input: CloseTurnInput): Promise<string> {
    return hook.closeTurn.execute(input);
}
