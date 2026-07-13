import type { AiJobStepEntity } from "@monitor/tracer-domain";

export const AI_JOB_STEP_REPOSITORY = Symbol("AiJobStepRepository");

/** AI 잡의 실행 궤적 스텝을 조회하는 애플리케이션 포트다. */
export interface AiJobStepRepositoryPort {
    findByJobId(jobId: string, userId: string): Promise<AiJobStepEntity[]>;
}
