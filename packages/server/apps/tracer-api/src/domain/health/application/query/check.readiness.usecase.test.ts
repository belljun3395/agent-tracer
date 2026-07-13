import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckReadinessUseCase } from "./check.readiness.usecase.js";
import type { ReadinessProbe } from "~tracer-api/domain/health/port/readiness.probe.port.js";

afterEach(() => {
    vi.useRealTimers();
});

describe("CheckReadinessUseCase", () => {
    it("Kafka 점검이 멈추면 deadline 뒤 준비되지 않음으로 반환한다", async () => {
        vi.useFakeTimers();
        const pingDb = vi.fn(async () => undefined);
        const pingKafka = vi.fn(() => new Promise<void>(() => undefined));
        const probe = {
            pingDb,
            pingKafka,
        } satisfies ReadinessProbe;
        const usecase = new CheckReadinessUseCase(probe);
        const settled = vi.fn();

        void usecase.execute().then(settled);
        await vi.advanceTimersByTimeAsync(1_001);

        expect(settled).toHaveBeenCalledWith(false);
        expect(pingDb).toHaveBeenCalledOnce();
        expect(pingKafka).toHaveBeenCalledOnce();
    });
});
