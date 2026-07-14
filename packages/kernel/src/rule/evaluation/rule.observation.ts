import { TOOL_ACTIVITY_EVENT_KINDS } from "~kernel/ingest/event.kind.const.js";
import { inferToolCall, type RuleEvaluationEvent } from "./rule.evaluation.context.js";
import type { ToolCall } from "../definition/rule.vocabulary.js";

const TOOL_ACTIVITY_KINDS = new Set<string>(TOOL_ACTIVITY_EVENT_KINDS);

/**
 * 판정이 먹는 이벤트의 형태이며, 도구 호출인데 분류하지 못한 것은 사라지지 않고 opaque로 남는다.
 */
export type Observation =
    | { readonly kind: "call"; readonly call: ToolCall }
    | { readonly kind: "opaque"; readonly eventId: string };

/** 도구 활동 이벤트를 관측으로 바꾸고, 그 밖의 이벤트는 판정 대상이 아니므로 버린다. */
export function observe(event: RuleEvaluationEvent & { readonly id: string }): Observation | null {
    const call = inferToolCall(event);
    if (call !== null) return { kind: "call", call };
    if (TOOL_ACTIVITY_KINDS.has(event.kind)) return { kind: "opaque", eventId: event.id };
    return null;
}

export function observedCalls(observations: readonly Observation[]): ToolCall[] {
    return observations.flatMap((observation) => (observation.kind === "call" ? [observation.call] : []));
}

export function unclassifiedEventIds(observations: readonly Observation[]): string[] {
    return observations.flatMap((observation) => (observation.kind === "opaque" ? [observation.eventId] : []));
}
