import type { IClock } from "@monitor/platform";

/** 주기 실행과 지금을 소유한다. 응용 계층은 지금을 인자로 받는 runOnce만 갖는다. */
export class PeriodicScheduler {
    private readonly timers: NodeJS.Timeout[] = [];

    constructor(private readonly clock: IClock) {}

    every(intervalMs: number, run: (now: Date) => Promise<unknown>): void {
        const timer = setInterval(() => void run(this.clock.now()), intervalMs);
        // 주기 실행이 프로세스 종료를 막지 않게 한다.
        timer.unref();
        this.timers.push(timer);
    }

    stopAll(): void {
        for (const timer of this.timers) clearInterval(timer);
        this.timers.length = 0;
    }
}
