import { describe, expect, it, vi } from "vitest";
import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import { AiJobEntity, InvariantViolationError } from "@monitor/tracer-domain";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import type { JobStatusChange, JobStatusNotifier } from "~tracer-api/domain/job/port/job.status.notifier.port.js";
import type { WorkflowDispatcherPort } from "~tracer-api/domain/job/port/workflow.dispatcher.port.js";
import { CancelJobUseCase } from "./cancel.job.usecase.js";

vi.mock("@monitor/platform", () => ({
    DomainError: class DomainError extends Error {},
    generateUlid: () => crypto.randomUUID(),
    createTemporalConnection: vi.fn(),
}));

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("CancelJobUseCase", () => {
    it("대기 중인 원격 잡을 취소하고 워크플로 취소를 요청한다", async () => {
        const job = pendingJob(JOB_KIND.recipeScan);
        const { useCase, dispatcher, notified } = makeUseCase(job, true);

        const result = await useCase.execute("u1", job.id, NOW);

        expect(result?.status).toBe(JOB_STATUS.canceled);
        expect(dispatcher.cancel).toHaveBeenCalledWith(JOB_KIND.recipeScan, job.id);
        expect(notified).toHaveLength(1);
        expect(notified[0]).toMatchObject({ jobId: job.id, status: JOB_STATUS.canceled });
    });

    it("로컬 실행 잡은 워크플로 취소를 요청하지 않는다", async () => {
        const job = pendingJob(JOB_KIND.ruleGeneration);
        const { useCase, dispatcher } = makeUseCase(job, true);

        await useCase.execute("u1", job.id, NOW);

        expect(dispatcher.cancel).not.toHaveBeenCalled();
    });

    it("워크플로 취소가 실패해도 잡 취소는 유지한다", async () => {
        const job = pendingJob(JOB_KIND.recipeScan);
        const { useCase, dispatcher } = makeUseCase(job, true);
        dispatcher.cancel.mockRejectedValueOnce(new Error("workflow not found"));

        const result = await useCase.execute("u1", job.id, NOW);

        expect(result?.status).toBe(JOB_STATUS.canceled);
    });

    it("이미 종료된 잡은 취소할 수 없다", async () => {
        const job = pendingJob(JOB_KIND.recipeScan);
        job.start(NOW);
        job.complete({}, {}, NOW);
        const { useCase } = makeUseCase(job, false);

        await expect(useCase.execute("u1", job.id, NOW)).rejects.toThrow(InvariantViolationError);
    });

    it("조건부 전이에서 지면 이미 종결된 잡으로 보고 거절한다", async () => {
        const job = pendingJob(JOB_KIND.recipeScan);
        const { useCase, dispatcher } = makeUseCase(job, false);

        await expect(useCase.execute("u1", job.id, NOW)).rejects.toThrow(InvariantViolationError);
        expect(dispatcher.cancel).not.toHaveBeenCalled();
    });

    it("남의 잡은 존재하지 않는 것처럼 null을 반환한다", async () => {
        const job = pendingJob(JOB_KIND.recipeScan);
        const { useCase } = makeUseCase(job, true);
        expect(await useCase.execute("u2", job.id, NOW)).toBeNull();
    });

    it("없는 잡은 null을 반환한다", async () => {
        const { useCase } = makeUseCase(null, true);
        expect(await useCase.execute("u1", "missing", NOW)).toBeNull();
    });
});

function pendingJob(kind: (typeof JOB_KIND)[keyof typeof JOB_KIND]): AiJobEntity {
    return AiJobEntity.create("u1", kind, {}, NOW);
}

function makeUseCase(job: AiJobEntity | null, transitionWins: boolean) {
    const jobs = new InMemoryAiJobRepository();
    if (job !== null) jobs.seed(job);
    if (!transitionWins) jobs.loseNextTransitionToCancel(NOW);
    const dispatcher = { cancel: vi.fn().mockResolvedValue(undefined) };
    const notified: JobStatusChange[] = [];
    const notifier: JobStatusNotifier = {
        notify: (_userId, change) => {
            notified.push(change);
        },
    };
    const useCase = new CancelJobUseCase(
        jobs,
        dispatcher as unknown as WorkflowDispatcherPort,
        notifier,
    );
    return { useCase, dispatcher, notified };
}
