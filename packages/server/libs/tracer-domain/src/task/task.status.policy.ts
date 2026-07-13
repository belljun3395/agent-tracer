import {
    COMPLETED_TASK_STATUS,
    KIND,
    RUNNING_TASK_STATUS,
    TASK_COMPLETION_REASON,
    WAITING_TASK_STATUS,
    type EventKind,
    type TaskCompletionReason,
    type TaskStatus,
} from "@monitor/kernel";

export interface TaskStatusEffectInput {
    readonly kind: EventKind;
    readonly explicitStatus?: TaskStatus;
    readonly completeTask?: boolean;
    readonly completionReason?: TaskCompletionReason;
    readonly resume?: boolean;
}

// 이벤트 하나가 task 상태에 미치는 효과를 도출한다. 효과 없음은 undefined.
export function resolveTaskStatusEffect(input: TaskStatusEffectInput): TaskStatus | undefined {
    if (input.explicitStatus !== undefined) return input.explicitStatus;

    if (input.kind === KIND.sessionEnded) return resolveSessionEndedEffect(input);
    if (input.kind === KIND.userMessage) return RUNNING_TASK_STATUS;
    if (input.kind === KIND.sessionStarted) return input.resume === false ? undefined : RUNNING_TASK_STATUS;

    return undefined;
}

function resolveSessionEndedEffect(input: TaskStatusEffectInput): TaskStatus | undefined {
    if (input.completeTask === true) return COMPLETED_TASK_STATUS;
    if (isSessionTerminatingReason(input.completionReason)) return COMPLETED_TASK_STATUS;
    if (isWaitingReason(input.completionReason)) return WAITING_TASK_STATUS;
    return undefined;
}

function isSessionTerminatingReason(reason: TaskCompletionReason | undefined): boolean {
    return reason === TASK_COMPLETION_REASON.explicitExit || reason === TASK_COMPLETION_REASON.runtimeTerminated;
}

function isWaitingReason(reason: TaskCompletionReason | undefined): boolean {
    return reason === TASK_COMPLETION_REASON.assistantTurnComplete || reason === TASK_COMPLETION_REASON.idle;
}
