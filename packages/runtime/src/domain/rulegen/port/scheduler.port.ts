/** 주기 실행을 응용 계층 밖에 두며, 돌려주는 함수를 부르면 그 주기가 멈춘다. */
export interface SchedulerPort {
    every(intervalMs: number, run: () => void): () => void;
}
