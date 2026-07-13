import { describe, expect, it, vi } from "vitest";
import { AI_JOB_STEP_ROLE, JOB_KIND } from "@monitor/kernel";
import { AiJobEntity, AiJobStepEntity } from "@monitor/tracer-domain";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { InMemoryAiJobStepRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.step.repository.js";
import { GetJobStepsUseCase } from "./get.job.steps.usecase.js";

vi.mock("@monitor/platform", () => ({
    DomainError: class DomainError extends Error {},
    generateUlid: () => crypto.randomUUID(),
    createTemporalConnection: vi.fn(),
}));

describe("GetJobStepsUseCase", () => {
    it("소유한 잡의 step 목록을 순서대로 반환한다", async () => {
        const useCase = makeUseCase(
            [job("job-1", "u1")],
            [
                step("step-2", "job-1", "u1", 1, "graph"),
                step("step-1", "job-1", "u1", 0, "user"),
            ],
        );

        const result = await useCase.execute("u1", "job-1");

        expect(result).toMatchObject([
            { seq: 0, attempt: 1, role: AI_JOB_STEP_ROLE.user, content: "step-0" },
            {
                seq: 1,
                attempt: 1,
                role: AI_JOB_STEP_ROLE.graph,
                content: "step-1",
                nodeName: "assess_evidence",
                eventKind: "node.completed",
                durationMs: 11,
            },
        ]);
    });

    it("남의 잡은 존재하지 않는 것처럼 null을 반환한다", async () => {
        const useCase = makeUseCase([job("job-1", "u1")], []);
        expect(await useCase.execute("u2", "job-1")).toBeNull();
    });

    it("없는 잡은 null을 반환한다", async () => {
        const useCase = makeUseCase([], []);
        expect(await useCase.execute("u1", "missing")).toBeNull();
    });
});

function makeUseCase(jobs: AiJobEntity[], steps: AiJobStepEntity[]): GetJobStepsUseCase {
    const jobRepo = new InMemoryAiJobRepository();
    jobRepo.seed(...jobs);
    const stepRepo = new InMemoryAiJobStepRepository();
    stepRepo.seed(...steps);
    return new GetJobStepsUseCase(jobRepo, stepRepo);
}

function job(id: string, userId: string): AiJobEntity {
    const job = AiJobEntity.create(
        userId,
        JOB_KIND.recipeScan,
        {},
        new Date("2026-07-10T00:00:00.000Z"),
    );
    job.id = id;
    return job;
}

function step(
    id: string,
    jobId: string,
    userId: string,
    seq: number,
    role: "user" | "graph",
): AiJobStepEntity {
    return AiJobStepEntity.create({
        id,
        jobId,
        userId,
        attempt: 1,
        step: {
            seq,
            role: role === "user" ? AI_JOB_STEP_ROLE.user : AI_JOB_STEP_ROLE.graph,
            content: `step-${seq}`,
            truncated: false,
            toolCalls: [],
            ...(role === "graph"
                ? { nodeName: "assess_evidence", eventKind: "node.completed" as const, durationMs: 11 }
                : {}),
        },
        now: new Date(`2026-07-10T00:0${seq}:00.000Z`),
    });
}
