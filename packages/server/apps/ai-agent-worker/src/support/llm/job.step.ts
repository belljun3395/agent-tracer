import { aiJobStepCarriesContent, type AiJobStepPayload } from "@monitor/kernel";

/** 저장 식별자가 확정된 궤적 스텝이다. */
export interface GeneratedAiJobStep extends AiJobStepPayload {
    readonly id: string;
}

/** 저장할 내용이 있는 궤적 스텝에만 식별자를 부여한다. */
export function assignStepIds(
    steps: readonly AiJobStepPayload[],
    nextId: () => string,
): readonly GeneratedAiJobStep[] {
    return steps
        .filter((step) => aiJobStepCarriesContent(step))
        .map((step) => ({ ...step, id: nextId() }));
}

/** 오케스트레이션 엔진이 준 이번 시도의 실행 맥락이다. */
export interface AgentAttemptRun {
    readonly attempt: number;
    readonly idempotencyKey: string;
    readonly abortSignal: AbortSignal;
}
