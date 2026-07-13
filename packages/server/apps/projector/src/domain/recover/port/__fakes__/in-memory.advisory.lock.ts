import type { AdvisoryLockPort } from "~projector/domain/recover/port/advisory.lock.port.js";

/** 어드바이저리 락 포트의 인메모리 대역이다. */
export class InMemoryAdvisoryLock<TScope = void> implements AdvisoryLockPort<TScope> {
    constructor(
        private readonly scope: TScope,
        private readonly acquired: boolean = true,
    ) {}

    async withAdvisoryLock<T>(_lockKey: number, work: (scope: TScope) => Promise<T>): Promise<T | null> {
        if (!this.acquired) return null;
        return work(this.scope);
    }
}
