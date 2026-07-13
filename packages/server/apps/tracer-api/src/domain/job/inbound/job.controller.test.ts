import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { AI_AGENT_BACKEND, JOB_KIND, JOB_STATUS, MONITOR_USER_HEADER } from "@monitor/kernel";
import { JobCommandController } from "./job.command.controller.js";
import { JobExecutionController } from "./job.execution.controller.js";
import { JobQueryController } from "./job.query.controller.js";
import { CancelJobUseCase } from "~tracer-api/domain/job/application/command/cancel.job.usecase.js";
import { EnqueueJobUseCase } from "~tracer-api/domain/job/application/command/enqueue.job.usecase.js";
import { ReleaseJobUseCase } from "~tracer-api/domain/job/application/command/release.job.usecase.js";
import { RenewJobLeaseUseCase } from "~tracer-api/domain/job/application/command/renew.job.lease.usecase.js";
import { GetLatestJobUseCase } from "~tracer-api/domain/job/application/query/get.latest.job.usecase.js";
import { GetJobUseCase } from "~tracer-api/domain/job/application/query/get.job.usecase.js";
import { ListJobHistoryUseCase } from "~tracer-api/domain/job/application/query/list.job.history.usecase.js";
import { ListPendingJobsUseCase } from "~tracer-api/domain/job/application/query/list.pending.jobs.usecase.js";
import { StartJobUseCase } from "~tracer-api/domain/job/application/command/start.job.usecase.js";
import { SubmitJobResultsUseCase } from "~tracer-api/domain/job/application/command/submit.job.results.usecase.js";
import { FailJobUseCase } from "~tracer-api/domain/job/application/command/fail.job.usecase.js";
import { SubmitJobFeedbackUseCase } from "~tracer-api/domain/job/application/command/submit.job.feedback.usecase.js";
import { GetJobStepsUseCase } from "~tracer-api/domain/job/application/query/get.job.steps.usecase.js";

vi.mock("@monitor/platform", () => ({
    DomainError: class DomainError extends Error {},
    generateUlid: () => crypto.randomUUID(),
    createTemporalConnection: vi.fn(),
}));

Reflect.defineMetadata(
    "design:paramtypes",
    [EnqueueJobUseCase, CancelJobUseCase, SubmitJobFeedbackUseCase],
    JobCommandController,
);
Reflect.defineMetadata(
    "design:paramtypes",
    [GetLatestJobUseCase, GetJobUseCase, ListPendingJobsUseCase, ListJobHistoryUseCase, GetJobStepsUseCase],
    JobQueryController,
);
Reflect.defineMetadata(
    "design:paramtypes",
    [StartJobUseCase, SubmitJobResultsUseCase, FailJobUseCase, RenewJobLeaseUseCase, ReleaseJobUseCase],
    JobExecutionController,
);

const submitResults = {
    execute: vi.fn(async () => ({
        job: {
            id: "job-1",
            userId: "u1",
            kind: JOB_KIND.ruleGeneration,
            executor: "local",
            status: JOB_STATUS.completed,
            attempts: 1,
            taskId: "task-1",
            input: {},
            result: { rulesCreated: 1 },
            usage: {},
            error: null,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
            startedAt: new Date(0).toISOString(),
            completedAt: new Date(0).toISOString(),
        },
    })),
};

const enqueueJob = {
    execute: vi.fn(async () => ({
        job: {
            id: "job-1",
            status: JOB_STATUS.pending,
            createdAt: new Date(0).toISOString(),
        },
    })),
};

const jobSteps = {
    execute: vi.fn(async () => [
        {
            seq: 0,
            role: "user",
            content: "Search recipes",
            truncated: false,
            toolCalls: [],
        },
    ]),
};

const getLatestJob = {
    execute: vi.fn(async () => ({ job: null })),
};

@Module({
    controllers: [JobQueryController, JobCommandController, JobExecutionController],
    providers: [
        { provide: CancelJobUseCase, useValue: { execute: vi.fn() } },
        { provide: EnqueueJobUseCase, useValue: enqueueJob },
        { provide: ReleaseJobUseCase, useValue: { execute: vi.fn() } },
        { provide: RenewJobLeaseUseCase, useValue: { execute: vi.fn() } },
        { provide: GetLatestJobUseCase, useValue: getLatestJob },
        { provide: GetJobUseCase, useValue: { execute: vi.fn() } },
        { provide: ListJobHistoryUseCase, useValue: { execute: vi.fn() } },
        { provide: ListPendingJobsUseCase, useValue: { execute: vi.fn() } },
        { provide: StartJobUseCase, useValue: { execute: vi.fn() } },
        { provide: SubmitJobResultsUseCase, useValue: submitResults },
        { provide: FailJobUseCase, useValue: { execute: vi.fn() } },
        { provide: SubmitJobFeedbackUseCase, useValue: { execute: vi.fn() } },
        { provide: GetJobStepsUseCase, useValue: jobSteps },
    ],
})
class TestModule {}

describe("잡 HTTP 컨트롤러", () => {
    let app: INestApplication | undefined;

    afterEach(async () => {
        enqueueJob.execute.mockClear();
        submitResults.execute.mockClear();
        jobSteps.execute.mockClear();
        getLatestJob.execute.mockClear();
        await app?.close();
        app = undefined;
    });

    it("enqueue 요청의 agentBackend를 usecase 옵션으로 전달한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}/api/v1/jobs`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                [MONITOR_USER_HEADER]: "u1",
            },
            body: JSON.stringify({
                kind: JOB_KIND.recipeScan,
                input: { taskId: "task-1" },
                agentBackend: AI_AGENT_BACKEND.claudeSdk,
                idempotencyKey: "scan-claude",
            }),
        });

        expect(res.status).toBe(202);
        expect(enqueueJob.execute).toHaveBeenCalledWith(
            "u1",
            JOB_KIND.recipeScan,
            { taskId: "task-1" },
            { idempotencyKey: "scan-claude", agentBackend: AI_AGENT_BACKEND.claudeSdk },
        );
    });

    it("rule-generation 결과 보고의 실행 메타데이터를 usage로 보존한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}/api/v1/jobs/job-1/results`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                [MONITOR_USER_HEADER]: "u1",
            },
            body: JSON.stringify({
                proposals: [],
                modelUsed: "claude-sonnet-4-6",
                durationMs: 1234,
                costUsd: 0.05,
                numTurns: 2,
                usage: { inputTokens: 10, outputTokens: 4 },
            }),
        });

        expect(res.status).toBe(200);
        expect(submitResults.execute).toHaveBeenCalledWith({
            userId: "u1",
            id: "job-1",
            proposals: [],
            usage: {
                inputTokens: 10,
                outputTokens: 4,
                model: "claude-sonnet-4-6",
                durationMs: 1234,
                costUsd: 0.05,
                numTurns: 2,
            },
        });
    });

    it("job steps 라우트는 :id 라우트보다 먼저 매칭된다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}/api/v1/jobs/job-1/steps`, {
            headers: { [MONITOR_USER_HEADER]: "u1" },
        });

        expect(res.status).toBe(200);
        expect(jobSteps.execute).toHaveBeenCalledWith("u1", "job-1");
    });

    it("latest 정적 라우트는 잡 상세 라우트보다 먼저 매칭된다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}/api/v1/jobs/latest?kind=${JOB_KIND.recipeScan}`, {
            headers: { [MONITOR_USER_HEADER]: "u1" },
        });

        expect(res.status).toBe(200);
        expect(getLatestJob.execute).toHaveBeenCalledWith("u1", JOB_KIND.recipeScan, undefined);
    });

});
