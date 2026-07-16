import {KIND} from "~runtime/domain/ingest/model/event.model.js";
import type {RunEventInput} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {TaskCompletionReason} from "~runtime/domain/ingest/model/event.model.js";

/** 서브에이전트 훅에는 부모 세션 식별자만 오므로 agent_id로 가상 세션을 판다. */
const SUBAGENT_PREFIX = "sub--";

export type TaskKind = "primary" | "background";
export type TaskOrigin = "user" | "server-sdk";

/** 런타임 세션을 태스크에 연결할 때 필요한 입력이다. */
export interface SessionBindingInput {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly title: string;
    readonly titled?: boolean;
    readonly workspacePath?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly origin?: TaskOrigin;
    readonly taskKind?: TaskKind;
    readonly resume?: boolean;
    readonly taskId?: string;
    /** 트랜스크립트에서 찾은 직전 런타임 세션 ID이며, 그 세션의 바인딩이 있으면 같은 태스크로 잇는다. */
    readonly resumedFrom?: string;
}

export function subagentSessionId(agentId: string): string {
    return `${SUBAGENT_PREFIX}${agentId}`;
}

export function isSubagentSession(runtimeSessionId: string): boolean {
    return runtimeSessionId.startsWith(SUBAGENT_PREFIX);
}

export function subagentTitle(agentId: string, agentType?: string): string {
    return agentType ? `Subagent: ${agentType}` : `Subagent: ${agentId}`;
}

export function sessionStartedEvent(
    taskId: string,
    sessionId: string,
    input: SessionBindingInput,
): RunEventInput {
    return {
        kind: KIND.sessionStarted,
        taskId,
        sessionId,
        payload: {
            runtimeSource: input.runtimeSource,
            runtimeSessionId: input.runtimeSessionId,
            title: input.title,
            ...(input.workspacePath ? {workspacePath: input.workspacePath} : {}),
            ...(input.parentTaskId ? {parentTaskId: input.parentTaskId} : {}),
            ...(input.parentSessionId ? {parentSessionId: input.parentSessionId} : {}),
            ...(input.taskKind ? {taskKind: input.taskKind} : {}),
            ...(input.origin ? {origin: input.origin} : {}),
            ...(input.resume !== undefined ? {resume: input.resume} : {}),
        },
    };
}

/** 임시 제목으로 만든 태스크에 진짜 제목이 도착하면 한 번만 발행한다. */
export function taskLinkedEvent(taskId: string, title: string): RunEventInput {
    return {kind: KIND.taskLinked, taskId, payload: {title}};
}

/** 세션이 끝났음을 원장에 알린다. */
export interface SessionEndInput {
    readonly taskId: string;
    readonly sessionId: string;
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly summary: string;
    readonly completionReason: TaskCompletionReason;
    readonly completeTask: boolean;
    readonly turnId?: string;
}

export function sessionEndedEvent(input: SessionEndInput): RunEventInput {
    return {
        kind: KIND.sessionEnded,
        taskId: input.taskId,
        sessionId: input.sessionId,
        ...(input.turnId ? {turnId: input.turnId} : {}),
        payload: {
            runtimeSource: input.runtimeSource,
            runtimeSessionId: input.runtimeSessionId,
            summary: input.summary,
            completionReason: input.completionReason,
            completeTask: input.completeTask,
        },
    };
}
