export const ADVISORY_LOCK = Symbol("AdvisoryLock");

/** 여러 projector 인스턴스 중 하나만 검색 색인 유지보수를 실행하도록 잠그고, 잠금을 얻지 못하면 null을 돌려주는 포트다. */
export interface AdvisoryLockPort<TScope = void> {
    withAdvisoryLock<T>(lockKey: number, work: (scope: TScope) => Promise<T>): Promise<T | null>;
}
