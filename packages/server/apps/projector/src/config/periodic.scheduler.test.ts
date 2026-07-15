import { describe, expect, it, vi } from "vitest";
import { PeriodicScheduler } from "./periodic.scheduler.js";

const clock = {
    now: () => new Date("2026-07-15T00:00:00.000Z"),
    nowMs: () => Date.parse("2026-07-15T00:00:00.000Z"),
    nowIso: () => "2026-07-15T00:00:00.000Z",
};

describe("PeriodicScheduler", () => {
    it("이전 실행이 끝나기 전에 interval이 지나면 중첩 실행하지 않는다", async () => {
        vi.useFakeTimers();
        let resolveRun: (() => void) | undefined;
        const run = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveRun = resolve;
                }),
        );
        const scheduler = new PeriodicScheduler(clock);
        scheduler.every("slow_job", 100, run);

        await vi.advanceTimersByTimeAsync(300);

        expect(run).toHaveBeenCalledTimes(1);
        resolveRun?.();
        await scheduler.stopAndDrain();
        vi.useRealTimers();
    });

    it("실패한 작업을 잡아 unhandled rejection으로 남기지 않는다", async () => {
        vi.useFakeTimers();
        const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        const scheduler = new PeriodicScheduler(clock);
        scheduler.every("failing_job", 100, () => Promise.reject(new Error("database unavailable")));

        await vi.advanceTimersByTimeAsync(100);
        await scheduler.stopAndDrain();

        expect(write).toHaveBeenCalledWith(
            expect.stringContaining('"msg":"projector.periodic_job.failed"'),
        );
        write.mockRestore();
        vi.useRealTimers();
    });

    it("종료 전에 실행 중인 작업이 settle될 때까지 기다린다", async () => {
        vi.useFakeTimers();
        let resolveRun: (() => void) | undefined;
        const scheduler = new PeriodicScheduler(clock);
        scheduler.every(
            "draining_job",
            100,
            () =>
                new Promise<void>((resolve) => {
                    resolveRun = resolve;
                }),
        );

        await vi.advanceTimersByTimeAsync(100);
        let drained = false;
        const drain = scheduler.stopAndDrain().then(() => {
            drained = true;
        });
        await Promise.resolve();

        expect(drained).toBe(false);
        resolveRun?.();
        await drain;

        expect(drained).toBe(true);
        vi.useRealTimers();
    });
});
