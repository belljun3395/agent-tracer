import { describe, expect, it } from "vitest";
import { JOB_KIND, JOB_STATUS, LOCAL_JOB_LEASE_TTL_MS } from "@monitor/kernel";
import { AiJobEntity, AiJobRepository } from "@monitor/tracer-domain";
import { asRepository, createInMemoryRepository } from "@monitor/tracer-domain/__fixtures__/in-memory-repository.js";
import { JobLeaseReaperService } from "~projector/domain/recover/application/job.lease.reaper.service.js";
import { InMemoryAdvisoryLock } from "~projector/domain/recover/port/__fakes__/in-memory.advisory.lock.js";

const NOW = new Date("2026-07-11T00:00:00.000Z");
const AFTER_TTL = new Date(NOW.getTime() + LOCAL_JOB_LEASE_TTL_MS + 1_000);

function claimedJob(owner: string): AiJobEntity {
    const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, NOW);
    job.claim(owner, NOW, LOCAL_JOB_LEASE_TTL_MS);
    return job;
}

function makeService(jobs: AiJobEntity[], options: { readonly lockHeld?: boolean } = {}): {
    readonly service: JobLeaseReaperService;
    readonly repo: AiJobRepository;
} {
    const store = createInMemoryRepository<AiJobEntity>();
    store.seed(...jobs);
    const repo = new AiJobRepository(asRepository(store));
    const lock = new InMemoryAdvisoryLock({ jobs: repo }, options.lockHeld !== true);
    return { service: new JobLeaseReaperService(lock), repo };
}

describe("JobLeaseReaperService", () => {
    it("리스가 만료된 실행 중 잡을 대기로 되돌린다", async () => {
        const job = claimedJob("dead-daemon");
        const { service, repo } = makeService([job]);

        const requeued = await service.runOnce(AFTER_TTL);

        expect(requeued).toBe(1);
        const stored = await repo.findById(job.id);
        expect(stored?.status).toBe(JOB_STATUS.pending);
        expect(stored?.leaseOwner).toBeNull();
    });

    it("리스가 살아 있는 잡은 건드리지 않는다", async () => {
        const job = claimedJob("live-daemon");
        const { service, repo } = makeService([job]);

        const requeued = await service.runOnce(NOW);

        expect(requeued).toBe(0);
        const stored = await repo.findById(job.id);
        expect(stored?.status).toBe(JOB_STATUS.running);
    });

    it("다른 러너가 락을 쥐고 있으면 아무것도 회수하지 않는다", async () => {
        const job = claimedJob("dead-daemon");
        const { service, repo } = makeService([job], { lockHeld: true });

        const requeued = await service.runOnce(AFTER_TTL);

        expect(requeued).toBe(0);
        const stored = await repo.findById(job.id);
        expect(stored?.status).toBe(JOB_STATUS.running);
    });
});
