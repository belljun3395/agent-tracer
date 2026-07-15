import type { IClock } from "@monitor/platform";
import { errorMessage, logError, logInfo } from "~projector/support/log.js";

interface ScheduledJob {
    readonly name: string;
    readonly timer: NodeJS.Timeout;
    running: Promise<void> | undefined;
}

/** 주기 실행과 지금을 소유하므로 응용 계층은 지금을 인자로 받는 runOnce만 갖는다. */
export class PeriodicScheduler {
    private readonly jobs: ScheduledJob[] = [];

    constructor(private readonly clock: IClock) {}

    every(name: string, intervalMs: number, run: (now: Date) => Promise<unknown>): void {
        const job: ScheduledJob = {
            name,
            timer: setInterval(() => this.run(job, run), intervalMs),
            running: undefined,
        };
        // 주기 실행이 프로세스 종료를 막지 않게 한다.
        job.timer.unref();
        this.jobs.push(job);
    }

    async stopAndDrain(): Promise<void> {
        for (const job of this.jobs) clearInterval(job.timer);
        await Promise.allSettled(this.jobs.flatMap((job) => (job.running ? [job.running] : [])));
        this.jobs.length = 0;
    }

    private run(job: ScheduledJob, run: (now: Date) => Promise<unknown>): void {
        if (job.running) {
            logInfo({ msg: "projector.periodic_job.skipped", job: job.name });
            return;
        }

        const startedAt = this.clock.now();
        job.running = Promise.resolve()
            .then(async () => {
                await run(startedAt);
            })
            .catch((error: unknown) => {
                logError({
                    msg: "projector.periodic_job.failed",
                    job: job.name,
                    durationMs: this.clock.now().getTime() - startedAt.getTime(),
                    error: errorMessage(error),
                });
            })
            .finally(() => {
                job.running = undefined;
            });
    }
}
