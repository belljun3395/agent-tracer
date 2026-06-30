export const RULE_GENERATION_DISPATCHER = "RULE_GENERATION_DISPATCHER";

// 생성된 잡의 실제 실행을 워커로 넘긴다. 어댑터가 Temporal 워크플로를 시작한다.
export interface IRuleGenerationDispatcher {
    dispatch(input: { jobId: string; taskId: string }): Promise<void>;
}
