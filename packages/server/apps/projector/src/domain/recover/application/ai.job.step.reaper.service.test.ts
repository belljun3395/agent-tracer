import { describe, expect, it } from "vitest";
import { AiJobStepReaperService } from "~projector/domain/recover/application/ai.job.step.reaper.service.js";
import { InMemoryAdvisoryLock } from "~projector/domain/recover/port/__fakes__/in-memory.advisory.lock.js";
import { InMemoryAiJobStepRepository } from "~projector/domain/recover/port/__fakes__/in-memory.ai.job.step.repository.js";

const RETENTION = 30 * 24 * 3_600_000;
const NOW = new Date("2026-08-01T00:00:00.000Z");
const OLD = new Date("2026-06-01T00:00:00.000Z");
const RECENT = new Date("2026-07-31T00:00:00.000Z");

interface Harness {
    readonly reaper: AiJobStepReaperService;
    readonly aiJobSteps: InMemoryAiJobStepRepository;
}

function makeHarness(opts: { rows?: readonly Date[]; lockAcquired?: boolean }): Harness {
    const aiJobSteps = new InMemoryAiJobStepRepository();
    aiJobSteps.seed(...opts.rows ?? []);
    const lock = new InMemoryAdvisoryLock({ aiJobSteps }, opts.lockAcquired ?? true);
    return { reaper: new AiJobStepReaperService(lock), aiJobSteps };
}

describe("AiJobStepReaperService", () => {
    it("보존 기간을 넘긴 스텝만 지우고 삭제 건수를 반환한다", async () => {
        const h = makeHarness({ rows: [OLD, OLD, RECENT] });

        const count = await h.reaper.runOnce(NOW, RETENTION);

        expect(count).toBe(2);
        expect(h.aiJobSteps.remaining()).toBe(1);
        expect(h.aiJobSteps.deleteCalls).toEqual([
            { cutoff: new Date(NOW.getTime() - RETENTION), limit: 1_000 },
        ]);
    });

    it("락을 못 잡으면 아무것도 지우지 않는다", async () => {
        const h = makeHarness({ rows: [OLD], lockAcquired: false });

        const count = await h.reaper.runOnce(NOW, RETENTION);

        expect(count).toBe(0);
        expect(h.aiJobSteps.deleteCalls).toEqual([]);
        expect(h.aiJobSteps.remaining()).toBe(1);
    });

    it("삭제 대상이 없으면 0을 반환한다", async () => {
        const h = makeHarness({ rows: [RECENT] });

        const count = await h.reaper.runOnce(NOW, RETENTION);

        expect(count).toBe(0);
    });
});
