import {
    AGENT_TRACER_ATTR,
    SEMCONV_ATTR,
    TURN_ACTIVITY_TYPE,
    toGenAiMessage,
} from "@monitor/kernel/observability/semconv.const.js";
import type {TurnState} from "~runtime/domain/binding/model/binding.model.js";
import {KIND, LANE, provenEvidence, type RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";
import {truncateOutput} from "~runtime/support/text.js";

const MESSAGE_HEAD_CHARS = 32_768;
const MESSAGE_TAIL_CHARS = 32_768;

/** 턴 프롬프트와 응답은 원장에 통째로 싣지 않고 앞뒤만 남긴다. */
export function capTurnMessage(text: string): string {
    return truncateOutput(text, MESSAGE_HEAD_CHARS, MESSAGE_TAIL_CHARS).body;
}

/** 턴 하나를 감싸는 span 이벤트를 만드는 데 필요한 입력이다. */
export interface TurnSpanInput {
    readonly taskId: string;
    readonly sessionId: string;
    readonly agentName: string;
    readonly stopReason: string;
    readonly response?: string;
    /** 사용자 발화 없이 시작되는 서브에이전트 턴에 쓸 대체 턴 ID다. */
    readonly fallbackTurnId: string;
    readonly sessionStartedAt?: string;
}

export interface TurnSpan {
    readonly turnId: string;
    readonly event: RuntimeIngestEvent;
}

/** 열린 턴을 감싸는 invoke_agent span 이벤트를 만든다. */
export function buildTurnSpan(turn: TurnState | undefined, input: TurnSpanInput): TurnSpan {
    const turnId = turn?.turnId ?? input.fallbackTurnId;
    const startedAt = turn?.startedAt ?? input.sessionStartedAt ?? new Date().toISOString();
    const durationMs = Math.max(0, Date.now() - Date.parse(startedAt));

    const event: RuntimeIngestEvent = {
        id: turnId,
        turnId,
        kind: KIND.invokeAgent,
        taskId: input.taskId,
        sessionId: input.sessionId,
        lane: LANE.user,
        title: `에이전트 턴 (${input.stopReason})`,
        metadata: {
            ...provenEvidence("턴 경계 훅이 관측했다."),
            activityType: TURN_ACTIVITY_TYPE,
            agentName: input.agentName,
            ...(Number.isFinite(durationMs) ? {durationMs} : {}),
            [SEMCONV_ATTR.responseFinishReasons]: input.stopReason,
            ...(turn?.prompt ? {[SEMCONV_ATTR.inputMessages]: toGenAiMessage("user", turn.prompt)} : {}),
            ...(input.response
                ? {[SEMCONV_ATTR.outputMessages]: toGenAiMessage("assistant", capTurnMessage(input.response))}
                : {}),
            ...(turn?.previousTurnId ? {[AGENT_TRACER_ATTR.turnPreviousId]: turn.previousTurnId} : {}),
        },
    };
    return {turnId, event};
}
