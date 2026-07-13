// 잡 종결 커밋 중 취소 등 다른 결말이 먼저 확정되면 트랜잭션 롤백 신호로 던지며, 호출부는 이를 정상 흐름으로 조용히 처리한다.
export class JobTransitionLostError extends Error {
    constructor(readonly jobId: string) {
        super(`Job transition lost: ${jobId}`);
        this.name = "JobTransitionLostError";
    }
}

export function isJobTransitionLost(error: unknown): error is JobTransitionLostError {
    return error instanceof JobTransitionLostError;
}
