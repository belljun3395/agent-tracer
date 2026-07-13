/** 보존 기간이 지난 잡 궤적 삭제가 사용하는 스텝 저장소 포트다. */
export interface AiJobStepReaperStepRepository {
    deleteOlderThan(cutoff: Date, limit: number): Promise<number>;
}

/** 삭제 트랜잭션 안에서 궤적 회수가 사용하는 저장소 경계다. */
export interface AiJobStepReaperRepositories {
    readonly aiJobSteps: AiJobStepReaperStepRepository;
}
