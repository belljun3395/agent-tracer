import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { JOB_KIND, JOB_STATUS, LOCAL_JOB_LEASE_TTL_MS } from "@monitor/kernel";
import { AiJobEntity } from "@monitor/tracer-domain";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { RenewJobLeaseUseCase } from "./renew.job.lease.usecase.js";

const NOW = new Date("2026-07-11T00:00:00.000Z");
const LATER = new Date("2026-07-11T00:00:30.000Z");

function claimedJob(owner: string): AiJobEntity {
    const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, NOW);
    job.claim(owner, NOW, LOCAL_JOB_LEASE_TTL_MS);
    return job;
}

function makeUseCase(jobs: AiJobEntity[]): { useCase: RenewJobLeaseUseCase; repo: InMemoryAiJobRepository } {
    const repo = new InMemoryAiJobRepository();
    repo.seed(...jobs);
    return { useCase: new RenewJobLeaseUseCase(repo), repo };
}

describe("RenewJobLeaseUseCase", () => {
    it("리스를 쥔 실행기의 하트비트는 리스를 연장한다", async () => {
        const job = claimedJob("daemon-1");
        const { useCase, repo } = makeUseCase([job]);

        const result = await useCase.execute({ userId: "u1", id: job.id, leaseOwner: "daemon-1", now: LATER });

        expect(result).toEqual({ leaseHeld: true, canceled: false });
        const stored = await repo.findById(job.id);
        expect(stored?.leaseExpiresAt?.getTime()).toBe(LATER.getTime() + LOCAL_JOB_LEASE_TTL_MS);
    });

    it("취소된 잡의 하트비트는 취소를 알려 실행기를 멈추게 한다", async () => {
        const job = claimedJob("daemon-1");
        job.cancel(NOW);
        const { useCase } = makeUseCase([job]);

        const result = await useCase.execute({ userId: "u1", id: job.id, leaseOwner: "daemon-1", now: LATER });

        expect(result).toEqual({ leaseHeld: false, canceled: true });
    });

    it("회수돼 리스를 잃은 구실행기의 하트비트는 리스 상실을 알린다", async () => {
        const job = claimedJob("daemon-1");
        const { useCase } = makeUseCase([job]);

        const result = await useCase.execute({ userId: "u1", id: job.id, leaseOwner: "daemon-2", now: LATER });

        expect(result).toEqual({ leaseHeld: false, canceled: false });
    });

    it("남의 잡은 존재하지 않는 잡처럼 거부한다", async () => {
        const job = claimedJob("daemon-1");
        const { useCase } = makeUseCase([job]);

        await expect(
            useCase.execute({ userId: "u2", id: job.id, leaseOwner: "daemon-1", now: LATER }),
        ).rejects.toThrow(NotFoundException);
    });
});

describe("AiJobEntity 리스", () => {
    it("리스가 만료되면 만료로 판정한다", () => {
        const job = claimedJob("daemon-1");
        const afterTtl = new Date(NOW.getTime() + LOCAL_JOB_LEASE_TTL_MS + 1);

        expect(job.isLeaseExpired(LATER)).toBe(false);
        expect(job.isLeaseExpired(afterTtl)).toBe(true);
    });

    it("회수하면 대기로 돌아가고 리스가 풀린다", () => {
        const job = claimedJob("daemon-1");

        job.requeue(LATER);

        expect(job.status).toBe(JOB_STATUS.pending);
        expect(job.leaseOwner).toBeNull();
        expect(job.leaseExpiresAt).toBeNull();
    });
});
