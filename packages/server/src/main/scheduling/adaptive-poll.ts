/**
 * Adaptive idle-backoff gate for `@nestjs/schedule` polling workers.
 *
 * The workers register a fixed-cadence `@Interval` at their *minimum* poll
 * interval, then call {@link AdaptivePoll.due} at the top of each tick to
 * decide whether to actually hit the database. After a run of idle ticks the
 * effective poll gap doubles (up to a ceiling); the next non-empty poll resets
 * it. This reproduces the behaviour of the previous hand-rolled
 * `setTimeout(currentIntervalMs)` recursion — the DB is polled at the same
 * widening cadence — while letting ScheduleModule own the timer lifecycle.
 *
 * Not thread-shared: each worker owns one instance and only mutates it from its
 * single-flight tick (guarded by the worker's `running` flag).
 */
export class AdaptivePoll {
    private idleTicks = 0;
    private currentIntervalMs: number;
    private nextPollAt = 0;

    constructor(
        private readonly minIntervalMs: number,
        private readonly maxIntervalMs: number,
        private readonly idleTicksBeforeBackoff: number,
    ) {
        this.currentIntervalMs = minIntervalMs;
    }

    /** True when the next DB poll is due (i.e. the backoff window has elapsed). */
    due(nowMs: number): boolean {
        return nowMs >= this.nextPollAt;
    }

    /** Record an empty poll; widen the gap once enough idle ticks accumulate. */
    onIdle(nowMs: number): void {
        this.idleTicks++;
        if (this.idleTicks >= this.idleTicksBeforeBackoff) {
            this.currentIntervalMs = Math.min(this.currentIntervalMs * 2, this.maxIntervalMs);
        }
        this.nextPollAt = nowMs + this.currentIntervalMs;
    }

    /** Record a non-empty poll; collapse back to the minimum cadence. */
    onWork(): void {
        this.idleTicks = 0;
        this.currentIntervalMs = this.minIntervalMs;
        this.nextPollAt = 0;
    }
}
