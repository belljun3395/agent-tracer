import type { EventEntity } from "../event/event.entity.js";
import { TurnEntity } from "./turn.entity.js";

/** 턴 조립이 이벤트 하나를 처리한 결과다. */
export type TurnMutation =
    | { readonly action: "open"; readonly turn: TurnEntity }
    | { readonly action: "close"; readonly turn: TurnEntity }
    | { readonly action: "attach"; readonly turnId: string }
    | { readonly action: "none" };

// 대화 이벤트 흐름에서 턴을 열고 닫는 상태 기계이며, "open" 결과에서 직전 열린 턴은 응답 없이 닫힌 채 함께 저장돼야 한다.
export class TurnAssembly {
    constructor(
        private readonly openTurn: TurnEntity | null,
        private readonly lastIndex: number,
    ) {}

    apply(event: EventEntity): TurnMutation {
        // 사용자 발화는 새 턴을 열며, 열린 턴이 있으면 응답 없이 닫는다.
        if (event.isUserMessage()) {
            if (event.sessionId === null) return { action: "none" };
            if (this.openTurn !== null) this.openTurn.endWithoutResponse(event.occurredAt);
            const turn = TurnEntity.open(
                event.sessionId,
                event.taskId,
                this.lastIndex + 1,
                event.body ?? event.title,
                event.occurredAt,
            );
            return { action: "open", turn };
        }
        // 어시스턴트 응답은 열린 턴을 닫는다.
        if (event.isAssistantResponse()) {
            if (this.openTurn === null) return { action: "none" };
            this.openTurn.close(event.body ?? event.title, event.occurredAt);
            return { action: "close", turn: this.openTurn };
        }
        // 그 밖의 이벤트는 열린 턴에 소속만 부여한다.
        if (this.openTurn !== null) return { action: "attach", turnId: this.openTurn.id };
        return { action: "none" };
    }
}
