import {KIND} from "~runtime/domain/ingest/model/event.model.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";

/** 마지막 사용자 발화부터 지금까지의 이벤트 창이다. */
export interface CurrentTurn {
    readonly askedText: string;
    readonly assistantText: string;
    readonly turnEvents: readonly RecentEvent[];
}

/** 아직 원장에 도착하지 않은 최종 응답까지 판정에 넣기 위한 문맥이다. */
export interface TurnContext {
    readonly sessionId?: string;
    readonly candidateAssistantText?: string;
}

export function sliceCurrentTurn(
    events: readonly RecentEvent[],
    context: TurnContext = {},
): CurrentTurn | null {
    const scoped = context.sessionId === undefined
        ? events
        : events.filter((event) => event.sessionId === context.sessionId);

    let openIndex = -1;
    for (let index = scoped.length - 1; index >= 0; index -= 1) {
        if (scoped[index]?.kind === KIND.userMessage) {
            openIndex = index;
            break;
        }
    }
    if (openIndex === -1) return null;

    const opening = scoped[openIndex]!;
    const turnEvents = scoped.slice(openIndex).filter((event) =>
        event.turnId === undefined || opening.turnId === undefined || event.turnId === opening.turnId,
    );
    const closing = turnEvents.at(-1);
    const observed = closing?.kind === KIND.assistantResponse ? textOf(closing) : "";
    return {
        askedText: textOf(opening),
        assistantText: observed !== "" ? observed : (context.candidateAssistantText ?? ""),
        turnEvents,
    };
}

function textOf(event: RecentEvent): string {
    return event.body ?? event.title ?? "";
}
